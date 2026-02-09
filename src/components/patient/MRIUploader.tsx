import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface MRIUploaderProps {
  onUploadComplete?: (reportId: string) => void;
}

export function MRIUploader({ onUploadComplete }: MRIUploaderProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
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

    setUploading(true);
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
          status: 'pending',
        })
        .select()
        .single();

      if (reportError) throw reportError;

      toast({
        title: 'Upload Successful',
        description: 'Your MRI scan has been uploaded and is being processed.',
      });

      clearFile();
      onUploadComplete?.(report.id);
    } catch (error: any) {
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload MRI scan.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
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
            <Button variant="ghost" size="icon" onClick={clearFile} disabled={uploading}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleUpload} disabled={uploading} className="flex-1">
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload for Analysis
                </>
              )}
            </Button>
            <Button variant="outline" onClick={clearFile} disabled={uploading}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}