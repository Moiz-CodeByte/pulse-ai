import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image, Loader2, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ReportAnalysisPanel } from '@/components/reports/ReportAnalysisPanel';
import { SendToDoctorDialog } from '@/components/patient/SendToDoctorDialog';
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
  const [latestReport, setLatestReport] = useState<{ id: string; name: string } | null>(null);
  const [sendToDoctorOpen, setSendToDoctorOpen] = useState(false);

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

      // Create MRI report record
      const { data: report, error: reportError } = await supabase
        .from('mri_reports')
        .insert({
          patient_id: user.id,
          file_url: fileName,
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
      setLatestReport({ id: report.id, name: file.name });
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
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>MRI Analysis Result</DialogTitle>
            <DialogDescription>
              The uploaded cardiac MRI scan has been screened by the saved AI model and summarized for the patient.
            </DialogDescription>
          </DialogHeader>

          <ReportAnalysisPanel
            analysis={analysisResult}
            preview={
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
            }
            footerMessage={
              analysisResult?.persistenceMessage || 'Result generated from the saved MRI model.'
            }
            footerActions={
              <>
                {latestReport && (
                  <Button variant="outline" onClick={() => setSendToDoctorOpen(true)}>
                    <Send className="mr-2 h-4 w-4" />
                    Send to Doctor
                  </Button>
                )}
                <Button variant="outline" onClick={() => setResultDialogOpen(false)}>
                  Close
                </Button>
                <Button asChild>
                  <Link to="/patient/reports">View Reports</Link>
                </Button>
              </>
            }
          />
        </DialogContent>
      </Dialog>

      <SendToDoctorDialog
        open={sendToDoctorOpen}
        onOpenChange={setSendToDoctorOpen}
        reportId={latestReport?.id || ''}
        reportName={latestReport?.name || ''}
      />
    </>
  );
}
