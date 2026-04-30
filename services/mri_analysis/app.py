from __future__ import annotations

import os
from io import BytesIO
from pathlib import Path
from typing import Any

try:
    from stream_chat import StreamChat as _StreamChat
    _STREAM_AVAILABLE = True
except ImportError:
    _StreamChat = None  # type: ignore
    _STREAM_AVAILABLE = False

import numpy as np
import pydicom
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image
from supabase import Client, create_client
from tensorflow.keras.models import load_model

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent.parent

load_dotenv(PROJECT_ROOT / '.env', override=True)
load_dotenv(BASE_DIR / '.env', override=False)

MODEL_PATH = Path(
    os.getenv(
        'MRI_ANALYSIS_MODEL_PATH',
        PROJECT_ROOT / 'notebooks' / 'active' / 'models' / 'best_vgg_finetuned.keras',
    )
)

CLASS_NAMES = ['NOR', 'DCM', 'MINF', 'RV', 'HCM']
CLASS_INFO: dict[str, dict[str, str]] = {
    'NOR': {
        'disease_name': 'Normal Cardiac Pattern',
        'detail': 'The scan is closest to a normal cardiac MRI pattern among the five trained classes.',
        'risk_level': 'low',
        'threat_level': 'Low',
        'patient_guidance': 'Keep regular checkups and continue a heart-healthy lifestyle, especially if symptoms are absent.',
        'clinical_priority': 'Routine follow-up',
    },
    'DCM': {
        'disease_name': 'Dilated Cardiomyopathy',
        'detail': 'The heart muscle can become enlarged and weaker, which may reduce pumping efficiency.',
        'risk_level': 'high',
        'threat_level': 'High',
        'patient_guidance': 'Arrange cardiology review soon, especially if you have fatigue, swelling, or shortness of breath.',
        'clinical_priority': 'Prompt specialist review',
    },
    'MINF': {
        'disease_name': 'Myocardial Infarction Pattern',
        'detail': 'The scan suggests a pattern compatible with prior heart muscle injury or scarring.',
        'risk_level': 'high',
        'threat_level': 'Critical',
        'patient_guidance': 'Seek urgent clinical assessment, especially if you have chest pain, breathing difficulty, or sudden weakness.',
        'clinical_priority': 'Urgent evaluation',
    },
    'RV': {
        'disease_name': 'Right Ventricular Abnormality',
        'detail': 'The scan suggests structural or functional changes affecting the right side of the heart.',
        'risk_level': 'medium',
        'threat_level': 'Moderate',
        'patient_guidance': 'Discuss the result with a cardiologist and monitor for palpitations, fainting, or reduced exercise tolerance.',
        'clinical_priority': 'Timely cardiology review',
    },
    'HCM': {
        'disease_name': 'Hypertrophic Cardiomyopathy',
        'detail': 'The scan suggests thickening of the heart muscle, which can affect blood flow and rhythm.',
        'risk_level': 'high',
        'threat_level': 'High',
        'patient_guidance': 'Book a cardiology appointment soon, especially if you notice chest discomfort, dizziness, or family history of sudden cardiac disease.',
        'clinical_priority': 'Prompt specialist review',
    },
}


def build_supabase_admin_client() -> Client | None:
    supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
    service_role_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

    if not supabase_url or not service_role_key:
        print('Warning: Supabase admin persistence is disabled. Set SUPABASE_SERVICE_ROLE_KEY to save analysis results.')
        return None

    return create_client(supabase_url, service_role_key)


if not MODEL_PATH.exists():
    raise FileNotFoundError(f'MRI model not found: {MODEL_PATH}')

prediction_model = load_model(MODEL_PATH)
supabase_admin = build_supabase_admin_client()


def build_stream_client():
    """Build GetStream server-side client if credentials are configured."""
    if not _STREAM_AVAILABLE:
        return None
    api_key = os.getenv('STREAM_API_KEY', '').strip()
    api_secret = os.getenv('STREAM_API_SECRET', '').strip()
    if not api_key or not api_secret:
        return None
    return _StreamChat(api_key=api_key, api_secret=api_secret)


stream_client = build_stream_client()

app = Flask(__name__)
CORS(app)

# Startup diagnostics
print(f'[Pulse AI] Project root: {PROJECT_ROOT}')
print(f'[Pulse AI] Supabase persistence: {bool(supabase_admin)}')
print(f'[Pulse AI] Stream chat configured: {bool(stream_client)}')


def decode_image(file_bytes: bytes, filename: str) -> np.ndarray:
    suffix = Path(filename).suffix.lower()

    if suffix in {'.dcm', '.dicom'}:
        dataset = pydicom.dcmread(BytesIO(file_bytes))
        pixel_array = dataset.pixel_array.astype('float32')

        if pixel_array.ndim == 3:
            if pixel_array.shape[-1] in (3, 4):
                pixel_array = pixel_array[..., :3].mean(axis=-1)
            else:
                pixel_array = pixel_array[pixel_array.shape[0] // 2]

        pixel_array -= pixel_array.min()
        max_value = pixel_array.max()
        if max_value > 0:
            pixel_array = pixel_array / max_value

        return (pixel_array * 255).astype('uint8')

    try:
        image = Image.open(BytesIO(file_bytes)).convert('L')
    except Exception as exc:
        raise ValueError(
            'Unable to read the uploaded MRI image. Please use a valid PNG, JPG, JPEG, or DICOM file.'
        ) from exc

    return np.asarray(image, dtype='uint8')


def preprocess_mri_image(file_bytes: bytes, filename: str, target_size: tuple[int, int] = (256, 256)) -> tuple[np.ndarray, np.ndarray]:
    image = decode_image(file_bytes, filename)
    image_resized = np.asarray(
        Image.fromarray(image).resize(target_size, Image.Resampling.BILINEAR),
        dtype='uint8',
    )
    image_normalized = image_resized.astype('float32') / 255.0
    image_batch = image_normalized[np.newaxis, ..., np.newaxis]
    return image_resized, image_batch


def build_patient_summary(prediction_scores: np.ndarray) -> dict[str, Any]:
    prediction_scores = np.asarray(prediction_scores, dtype='float32')
    predicted_index = int(np.argmax(prediction_scores))
    predicted_label = CLASS_NAMES[predicted_index]
    confidence = round(float(prediction_scores[predicted_index]) * 100, 2)
    info = CLASS_INFO[predicted_label].copy()

    confidence_note = (
        'Model confidence is limited. Treat this as a screening result and confirm it clinically.'
        if confidence < 60
        else 'Model confidence is stronger, but clinical confirmation is still required.'
    )

    ranked_results = [
        {
            'label': label,
            'probability': round(float(probability) * 100, 2),
        }
        for label, probability in sorted(
            zip(CLASS_NAMES, prediction_scores),
            key=lambda item: item[1],
            reverse=True,
        )
    ]

    recommendation = f"{info['patient_guidance']} Priority: {info['clinical_priority']}."

    return {
        'predictedLabel': predicted_label,
        'diseaseName': info['disease_name'],
        'riskLevel': info['risk_level'],
        'threatLevel': info['threat_level'],
        'confidence': confidence,
        'detail': info['detail'],
        'patientGuidance': info['patient_guidance'],
        'clinicalPriority': info['clinical_priority'],
        'confidenceNote': confidence_note,
        'recommendation': recommendation,
        'rankedResults': ranked_results,
        'persisted': False,
        'persistenceMessage': None,
    }


def format_diagnosis_details(summary: dict[str, Any]) -> str:
    return '\n'.join(
        [
            f"Predicted disease: {summary['diseaseName']} ({summary['predictedLabel']})",
            f"Threat level: {summary['threatLevel']}",
            f"Disease detail: {summary['detail']}",
            f"Patient guidance: {summary['patientGuidance']}",
            f"Clinical priority: {summary['clinicalPriority']}",
            f"Confidence note: {summary['confidenceNote']}",
        ]
    )


def mark_report_status(report_id: str, status: str) -> None:
    if not supabase_admin:
        return

    supabase_admin.table('mri_reports').update({'status': status}).eq('id', report_id).execute()


def persist_summary(report_id: str, summary: dict[str, Any]) -> dict[str, Any]:
    if not report_id:
        summary['persisted'] = False
        summary['persistenceMessage'] = 'No report identifier was provided, so the result was not saved.'
        return summary

    if not supabase_admin:
        summary['persisted'] = False
        summary['persistenceMessage'] = 'SUPABASE_SERVICE_ROLE_KEY is not configured, so the result was not saved to reports.'
        return summary

    diagnosis_payload = {
        'report_id': report_id,
        'risk_level': summary['riskLevel'],
        'confidence': summary['confidence'],
        'details': format_diagnosis_details(summary),
    }

    supabase_admin.table('diagnosis').upsert(diagnosis_payload, on_conflict='report_id').execute()
    mark_report_status(report_id, 'completed')

    summary['persisted'] = True
    summary['persistenceMessage'] = 'Analysis result saved to the patient report.'
    return summary


@app.get('/health')
def health_check() -> Any:
    return jsonify(
        {
            'status': 'ok',
            'modelPath': str(MODEL_PATH),
            'supabasePersistence': bool(supabase_admin),
        }
    )


@app.post('/analyze')
def analyze_mri() -> Any:
    uploaded_file = request.files.get('mri_image')
    report_id = request.form.get('report_id', '').strip()

    if uploaded_file is None:
        return jsonify({'error': 'No MRI image was uploaded.'}), 400

    try:
        file_bytes = uploaded_file.read()
        _, model_input = preprocess_mri_image(file_bytes, uploaded_file.filename or 'scan')
        prediction_scores = prediction_model.predict(model_input, verbose=0)[0]
        summary = build_patient_summary(prediction_scores)
        response = persist_summary(report_id, summary)
        return jsonify(response)
    except Exception as exc:
        if report_id:
            mark_report_status(report_id, 'failed')
        return jsonify({'error': str(exc)}), 500


@app.post('/admin/create-user')
def admin_create_user() -> Any:
    """Admin endpoint to create a new user with auth account, profile, and role."""
    if not supabase_admin:
        return jsonify({'error': 'Admin client not configured'}), 500

    data = request.get_json()
    
    # Validate required fields
    email = data.get('email', '').strip()
    password = data.get('password', '').strip()
    full_name = data.get('fullName', '').strip()
    role = data.get('role', 'patient')
    verified = data.get('verified', True)
    
    if not email or not password or not full_name:
        return jsonify({'error': 'Email, password, and full name are required'}), 400
    
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    
    if role not in ['patient', 'doctor', 'admin']:
        return jsonify({'error': 'Invalid role'}), 400
    
    try:
        # Create auth user using admin client
        auth_response = supabase_admin.auth.admin.create_user({
            'email': email,
            'password': password,
            'email_confirm': True,
        })
        
        if not auth_response.user:
            return jsonify({'error': 'Failed to create auth user'}), 500
        
        user_id = auth_response.user.id
        
        # Create profile
        profile_response = supabase_admin.table('profiles').insert({
            'id': user_id,
            'full_name': full_name,
            'email': email,
        }).execute()
        
        # Create user role
        role_response = supabase_admin.table('user_roles').insert({
            'user_id': user_id,
            'role': role,
            'verified': verified if role == 'doctor' else True,
        }).execute()
        
        return jsonify({
            'success': True,
            'user_id': user_id,
            'message': f'User {full_name} created successfully as {role}',
        })
        
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500


@app.post('/stream/token')
def get_stream_token() -> Any:
    """Generate a Stream user token for the authenticated user."""
    if not stream_client:
        return jsonify({'error': 'Stream chat is not configured. Set STREAM_API_KEY and STREAM_API_SECRET.'}), 503

    data = request.get_json()
    user_id = (data or {}).get('user_id', '').strip()
    user_name = (data or {}).get('user_name', '').strip()
    user_role = (data or {}).get('user_role', 'patient').strip()

    if not user_id:
        return jsonify({'error': 'user_id is required'}), 400

    # Upsert the user in Stream
    try:
        stream_client.update_user({
            'id': user_id,
            'name': user_name or user_id,
            'role': 'user',
            'app_role': user_role,
        })
    except Exception as exc:
        print(f'[Stream] update_user failed: {exc}')

    token = stream_client.create_token(user_id)
    api_key = os.getenv('STREAM_API_KEY', '')

    return jsonify({'token': token, 'api_key': api_key})


@app.post('/stream/create-channel')
def create_stream_channel() -> Any:
    """Create (or retrieve) a Stream channel for a consultation."""
    if not stream_client:
        return jsonify({'error': 'Stream chat is not configured.'}), 503

    data = request.get_json()
    consultation_id = (data or {}).get('consultation_id', '').strip()
    patient_id = (data or {}).get('patient_id', '').strip()
    patient_name = (data or {}).get('patient_name', 'Patient').strip()
    doctor_id = (data or {}).get('doctor_id', '').strip()
    doctor_name = (data or {}).get('doctor_name', 'Doctor').strip()
    report_info = (data or {}).get('report_info', {})

    if not consultation_id or not patient_id:
        return jsonify({'error': 'consultation_id and patient_id are required'}), 400

    channel_id = f'consultation-{consultation_id}'

    # Upsert both users in Stream
    members = [
        {'id': patient_id, 'name': patient_name, 'role': 'user', 'app_role': 'patient'},
    ]
    if doctor_id:
        members.append({'id': doctor_id, 'name': doctor_name, 'role': 'user', 'app_role': 'doctor'})

    try:
        stream_client.update_users(members)
    except Exception as exc:
        print(f'[Stream] upsert_users failed: {exc}')
        # Non-fatal — continue even if user upsert fails

    member_ids = [patient_id] + ([doctor_id] if doctor_id else [])

    # Create the channel
    try:
        channel = stream_client.channel(
            'messaging',
            channel_id,
            {
                'members': member_ids,
                'consultation_id': consultation_id,
                'report_name': report_info.get('name', ''),
                'report_risk': report_info.get('risk_level', ''),
                'report_diagnosis': report_info.get('diagnosis', ''),
                'report_id': report_info.get('report_id', ''),
            },
        )
        channel.create(patient_id)
    except Exception as exc:
        print(f'[Stream] channel.create failed: {exc}')
        return jsonify({'error': f'Failed to create Stream channel: {exc}'}), 500

    # Send an initial system message with report details
    if report_info:
        try:
            risk = report_info.get('risk_level', 'unknown').upper()
            diagnosis = report_info.get('diagnosis', '')
            urgency = report_info.get('urgency', 'routine')
            symptoms = report_info.get('symptoms', '')
            patient_msg = report_info.get('patient_message', '')

            system_text = (
                f'**New Consultation Request**\n\n'
                f'**Report:** {report_info.get("name", "MRI Report")}\n'
                f'**Risk Level:** {risk}\n'
                + (f'**Diagnosis:** {diagnosis}\n' if diagnosis else '')
                + (f'**Urgency:** {urgency.capitalize()}\n' if urgency else '')
                + (f'**Symptoms:** {symptoms}\n' if symptoms else '')
                + (f'**Patient Note:** {patient_msg}\n' if patient_msg else '')
            )

            channel.send_message(
                {'text': system_text},
                user_id=patient_id,
            )
        except Exception as exc:
            print(f'[Stream] send_message failed: {exc}')
            # Non-fatal — channel exists, message is optional

    return jsonify({'channel_id': channel_id, 'api_key': os.getenv('STREAM_API_KEY', '')})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('MRI_ANALYSIS_PORT', '5000')), debug=False)