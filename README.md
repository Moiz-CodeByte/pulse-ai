# Pulse AI - AI Based Heart Disease Detection System MRI

Pulse AI is a full-stack cardiac MRI analysis and doctor consultation platform. It combines a React patient/doctor/admin dashboard with a Flask MRI analysis service powered by a fine-tuned VGG16 model.

Live project: [https://pulseai.abdulmoiz.net/](https://pulseai.abdulmoiz.net/)

## Overview

Pulse AI helps patients upload cardiac MRI reports, receive AI-assisted disease risk analysis, send reports to verified doctors, chat with doctors, receive prescriptions, download branded PDF reports, and review doctors after prescriptions. Doctors can review assigned cases, inspect report timelines, chat with patients, prescribe medicines, and track patient reviews.

The research notebooks, extracted metrics, figures, and supporting experiments are maintained in the Pulse AI notebook resources. The trained best VGG16 model is loaded by the Flask analysis API.

## Features

- Patient MRI upload and analysis
- AI-assisted cardiac MRI classification
- Risk level, confidence, diagnosis details, urgency, and patient guidance
- Patient dashboard with reports, cases, prescriptions, chats, and doctor reviews
- Doctor dashboard with assigned cases, case timelines, chat, prescriptions, and patient reviews
- Shared patient-doctor chat channel per patient/doctor pair
- Case timeline for repeated reports sent to the same doctor
- Prescription flow with report/case reference
- Doctor review flow after prescription
- Branded PDF report download with Pulse AI logo and website link
- Admin user and doctor verification workflows
- Supabase authentication, database, storage, and row-level security
- GetStream chat token/channel integration

## Technology Stack

### Frontend

- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui and Radix UI
- lucide-react icons
- Supabase client
- Stream Chat
- jsPDF

### Backend

- Python
- Flask
- TensorFlow / Keras
- VGG16 fine-tuned model
- Pillow, NumPy, pydicom
- Supabase admin client
- Stream Chat server client

### Notebook / Model Research

- Jupyter Notebook / Google Colab
- TensorFlow / Keras
- VGG16 transfer learning
- Matplotlib, Seaborn
- scikit-learn
- OpenCV

## Project Structure

```text
pulse-ai/
  src/                       React app source
    components/              Shared UI, reports, chat, cases, patient components
    hooks/                   Auth, Stream chat, theme, toast hooks
    integrations/supabase/   Supabase client and generated types
    lib/                     MRI reports, labels, permissions, doctor profiles
    pages/                   Patient, doctor, admin, auth, landing pages
  services/mri_analysis/     Flask MRI analysis and Stream token API
  supabase/migrations/       Database schema, RLS, consultation, review migrations
  public/                    Static frontend assets
  Dataset/                   Local dataset folder, ignored by Git
  notebooks/                 Local notebook/model folder, ignored by Git
  cache/                     Downloaded model cache, ignored by Git
```

Notebook resources are available in the companion notebook project:

```text
Pulse Ai Notebooks/
  Pulse-ai.ipynb
  ai-based-heart-disease-detection-system-mri.ipynb
  notebooks/active/
  notebooks/archive/
  notebooks/archive/figures/
  notebooks/archive/scripts/
```

## Model Resources

The trained best VGG16 model can be downloaded from Google Drive:

[Download best VGG16 model](https://drive.google.com/file/d/1Mx6UfN7jbGhY586NN53qxyoZTEmnGWIG/view?usp=sharing)

Recommended local model path:

```text
notebooks/active/models/best_vgg_finetuned.keras
```

Model files are intentionally ignored by Git because trained `.keras` files can exceed GitHub file size limits. The backend can also download/cache the model when `MRI_ANALYSIS_MODEL_PATH` is set to a URL.

## Prerequisites

- Node.js 18 or newer
- npm
- Python 3.10 or newer
- Supabase project
- GetStream Chat app
- Trained VGG16 `.keras` model or hosted model URL

## Environment Variables

Create a local `.env` file in `pulse-ai/`. Do not commit real keys.

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=

VITE_STREAM_API_KEY=
STREAM_API_KEY=
STREAM_API_SECRET=

VITE_MRI_ANALYSIS_API_URL=http://127.0.0.1:5000
MRI_ANALYSIS_MODEL_PATH=notebooks/active/models/best_vgg_finetuned.keras

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Notes:

- `VITE_*` variables are exposed to the frontend.
- `SUPABASE_SERVICE_ROLE_KEY` and `STREAM_API_SECRET` are backend-only secrets.
- In production, set `VITE_MRI_ANALYSIS_API_URL` to the deployed Flask API URL.

## Installation

Install frontend dependencies:

```bash
npm install
```

Install backend dependencies:

```bash
cd services/mri_analysis
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

On macOS/Linux:

```bash
cd services/mri_analysis
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Running Locally

Start the Flask MRI analysis API:

```bash
npm run analysis:api
```

Or run directly:

```bash
python services/mri_analysis/app.py
```

Start the frontend:

```bash
npm run dev
```

Open the Vite URL shown in the terminal, usually:

```text
http://localhost:5173
```

## Backend API

The Flask service exposes:

- `GET /health` - service health and configuration status
- `POST /analyze` - MRI image analysis
- `POST /admin/create-user` - admin user creation helper
- `POST /stream/token` - GetStream user token endpoint
- `POST /stream/create-channel` - creates/updates consultation chat channels

## Supabase

Database schema and RLS policies are in:

```text
supabase/migrations/
```

Important modules include:

- profiles and user roles
- MRI reports
- diagnosis records
- prescriptions
- doctor information
- consultation requests
- Stream channel IDs
- doctor reviews and rating aggregation

Apply migrations to the Supabase project before using the app in production.

## Scripts

```bash
npm run dev          # Start frontend dev server
npm run build        # Production build
npm run build:dev    # Development-mode build
npm run preview      # Preview built frontend
npm run lint         # Run ESLint
npm run test         # Run Vitest
npm run test:watch   # Watch tests
npm run analysis:api # Start Flask MRI analysis API
```

## Notebook Resources

The companion notebook project contains the model training and evaluation work.

Repository contents from the notebook resources:

- `Pulse-ai.ipynb` - main Pulse AI notebook
- `ai-based-heart-disease-detection-system-mri.ipynb` - original MRI detection notebook
- `notebooks/active/` - active notebooks, extracted text, and metrics
- `notebooks/archive/` - archived backend notebooks, scripts, and generated figures
- `notebooks/archive/figures/` - confusion matrices, dataset distribution plots, training history charts, and sample outputs
- `notebooks/archive/scripts/` - supporting Flask and Node.js scripts

Notebook setup:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install tensorflow keras numpy pandas matplotlib seaborn scikit-learn opencv-python jupyter
jupyter notebook
```

Open `Pulse-ai.ipynb` or the notebooks inside `notebooks/active/` and run the cells in order.

## Research References

- Project Deployment: [https://pulseai.abdulmoiz.net/](https://pulseai.abdulmoiz.net/)
- GitHub Repository: [https://github.com/Moiz-CodeByte/pulse-ai](https://github.com/Moiz-CodeByte/pulse-ai)
- Notebook Repository: [https://github.com/Moiz-CodeByte/pulse-ai-notebook](https://github.com/Moiz-CodeByte/pulse-ai-notebook)
- Kaggle Notebook: [AI Based Heart MRI Detection System - Pulse AI](https://www.kaggle.com/code/moizkalid/ai-based-heart-mri-detection-system-pluse-ai)
- Google Colab Notebook: [https://colab.research.google.com/drive/1mZ1CFhKMvCUXa0Qp2dUeGSBlb38P7rim](https://colab.research.google.com/drive/1mZ1CFhKMvCUXa0Qp2dUeGSBlb38P7rim)
- CAD Dataset VGG16 Notebook for Testing: [https://www.kaggle.com/code/moizkalid/cad-pulse-ai-vgg16](https://www.kaggle.com/code/moizkalid/cad-pulse-ai-vgg16)
- CAD Dataset CNN Notebook for Testing: [https://www.kaggle.com/code/moizkalid/cad-cnn-pulse-ai](https://www.kaggle.com/code/moizkalid/cad-cnn-pulse-ai)
- Best VGG16 Model: [Google Drive download](https://drive.google.com/file/d/1Mx6UfN7jbGhY586NN53qxyoZTEmnGWIG/view?usp=sharing)

## Deployment Notes

- Deploy the React app as a static Vite build.
- Deploy `services/mri_analysis/app.py` as the Python API.
- Configure production CORS and `VITE_MRI_ANALYSIS_API_URL` to point to the API.
- Apply all Supabase migrations.
- Configure Supabase storage bucket `mri-images`.
- Configure Stream API key/secret for chat.
- Use a hosted model URL or mount the `.keras` model file on the backend.

## License

This project is licensed under the MIT License. See the LICENSE file if present.

## Contact

For questions or support, contact [hello@abdulmoiz.net](mailto:hello@abdulmoiz.net).
