import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image, Loader2, Activity, ShieldAlert, Stethoscope } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { analyzeMRI, type MRIAnalysisResult } from '@/lib/mriAnalysis';

interface MRIUploaderProps {
  onUploadComplete?: (reportId: string) => void;
}

export function MRIUploader({ onUploadComplete }: MRIUploaderProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submissionState, setSubmissionState] = useState<'idle' | 'uploading' | 'analyzing'>('idle');
  const [analysisResult, setAnalysisResult] = useState<MRIAnalysisResult | null>(null);
  const [resultPreview, setResultPreview] = useState<string | null>(null);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);

  const isBusy = submissionState !== 'idle';

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);

      const extension = selectedFile.name.split('.').pop()?.toLowerCase();
      const supportsPreview = extension !== 'dcm' && extension !== 'dicom';

      if (!supportsPreview) {
        setPreview(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(selectedFile);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.dcm', '.dicom']
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const clearFile = () => {
    setFile(null);
    setPreview(null);
  };

  const handleUpload = async () => {
    if (!file || !user) return;

    let uploadedReportId: string | null = null;
    const currentPreview = preview;

    setSubmissionState('uploading');
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('mri-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('mri-images')
        .getPublicUrl(fileName);

      // Create MRI report record
      const { data: report, error: reportError } = await supabase
        .from('mri_reports')
        .insert({
          patient_id: user.id,
          file_url: publicUrl,
          file_name: file.name,
          status: 'processing',
        })
        .select()
        .single();

      if (reportError) throw reportError;

      uploadedReportId = report.id;
      setSubmissionState('analyzing');

      const analysis = await analyzeMRI(file, report.id);

      setAnalysisResult(analysis);
      setResultPreview(currentPreview);
      setResultDialogOpen(true);

      toast({
        title: 'Analysis Complete',
        description: analysis.persisted
          ? 'Your MRI scan was analyzed and saved to your reports.'
          : analysis.persistenceMessage || 'Your MRI scan was analyzed, but the result was not saved to your reports.',
      });

      clearFile();
      onUploadComplete?.(report.id);
    } catch (error: any) {
      toast({
        title: uploadedReportId ? 'Analysis Failed' : 'Upload Failed',
        description: uploadedReportId
          ? error.message || 'The MRI scan was uploaded, but the analysis service did not return a result.'
          : error.message || 'Failed to upload MRI scan.',
        variant: 'destructive',
      });

      if (uploadedReportId) {
        clearFile();
        onUploadComplete?.(uploadedReportId);
      }
    } finally {
      setSubmissionState('idle');
    }
  };

  return (
    <>
      <div className="space-y-4">
        {!file ? (
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
              ${isDragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50 hover:bg-muted/50'
              }
            `}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-primary/10">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-lg font-medium text-foreground">
                  {isDragActive ? 'Drop your MRI scan here' : 'Upload Cardiac MRI Scan'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Drag and drop or click to select a file
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Supported formats: PNG, JPG, DICOM • Max size: 50MB
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="border rounded-xl p-4 bg-card">
            <div className="flex items-start gap-4">
              {preview ? (
                <img 
                  src={preview} 
                  alt="MRI Preview" 
                  className="w-24 h-24 object-cover rounded-lg border"
                />
              ) : (
                <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center">
                  <Image className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={clearFile} disabled={isBusy}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={handleUpload} disabled={isBusy} className="flex-1">
                {submissionState === 'uploading' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading scan...
                  </>
                ) : submissionState === 'analyzing' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running AI analysis...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload for Analysis
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={clearFile} disabled={isBusy}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={resultDialogOpen} onOpenChange={setResultDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>MRI Analysis Result</DialogTitle>
            <DialogDescription>
              The uploaded cardiac MRI scan has been screened by the saved AI model and summarized for the patient.
            </DialogDescription>
          </DialogHeader>

          {analysisResult && (
            <div className="grid gap-6 lg:grid-cols-[220px,1fr] py-2">
              <div className="space-y-4">
                <div className="aspect-square overflow-hidden rounded-xl border bg-muted">
                  {resultPreview ? (
                    <img
                      src={resultPreview}
                      alt="Uploaded MRI preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Image className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                </div>

                <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Threat Level</p>
                    <div className="mt-2">
                      <RiskBadge level={analysisResult.riskLevel} size="sm" />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{analysisResult.threatLevel}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Clinical Priority</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{analysisResult.clinicalPriority}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Predicted Disease</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{analysisResult.diseaseName}</p>
                    <p className="text-sm text-muted-foreground">Class: {analysisResult.predictedLabel}</p>
                  </div>

                  <div className="rounded-xl border p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Activity className="h-4 w-4" />
                      <p className="text-xs font-medium uppercase tracking-wide">Model Confidence</p>
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{analysisResult.confidence.toFixed(2)}%</p>
                    <p className="mt-1 text-sm text-muted-foreground">{analysisResult.confidenceNote}</p>
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-foreground">Disease Detail</h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{analysisResult.detail}</p>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-foreground">Patient Guidance</h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{analysisResult.patientGuidance}</p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{analysisResult.recommendation}</p>
                </div>

                <div className="rounded-xl border p-4">
                  <h3 className="font-semibold text-foreground">Prediction Breakdown</h3>
                  <div className="mt-4 space-y-3">
                    {analysisResult.rankedResults.map((result) => (
                      <div key={result.label} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-foreground">{result.label}</span>
                          <span className="text-muted-foreground">{result.probability.toFixed(2)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.max(result.probability, 2)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {analysisResult?.persistenceMessage || 'Result generated from the saved MRI model.'}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setResultDialogOpen(false)}>
                Close
              </Button>
              <Button asChild>
                <Link to="/patient/reports">View Reports</Link>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}