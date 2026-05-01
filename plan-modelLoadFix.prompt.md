Plan

1. Identify the failure path:
   - Backend loads MRI model using `MRI_ANALYSIS_MODEL_PATH`.
   - Existing code assumes a local filesystem path and calls `Path(...).exists()`.
   - In production, the env value is a URL (`https://abdulmoiz.net/best_vgg_finetuned.keras`), so the backend cannot load the model.
   - This causes the analysis API to fail or hang, leaving report status stuck at "processing".

2. Update backend model loading logic in `services/mri_analysis/app.py`:
   - Read `MRI_ANALYSIS_MODEL_PATH` as a string.
   - If the value starts with `http://` or `https://`, download the model file to a temporary local file.
   - If the value is a local path, verify the file exists normally.
   - Load the model from the resolved local path.
   - Add logging or health-check output to confirm correct model source.

3. Add runtime dependency:
   - Add `requests` to `services/mri_analysis/requirements.txt` for URL download support.

4. Fix frontend failure handling in `src/components/patient/MRIUploader.tsx`:
   - Create the report with `status: 'processing'` before analysis.
   - If analysis fails after report creation, update the report status to `failed`.
   - Ensure error handling does not leave the report stuck indefinitely.

5. Verify deployed environment settings:
   - Confirm `VITE_MRI_ANALYSIS_API_URL` points to the deployed backend, not localhost.
   - Confirm production env actually exports `MRI_ANALYSIS_MODEL_PATH` correctly.

6. Test and validate:
   - Start the backend and call `/health` to verify model loads.
   - Upload an MRI scan from mobile and desktop in production.
   - Confirm reports move from `processing` to `completed` or `failed` correctly.

7. If the backend still fails:
   - Inspect production logs for model download or load errors.
   - Check for network/CORS issues on mobile.
   - Confirm that the model URL is reachable from the deployed server.
