import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { MRIUploader } from '@/components/patient/MRIUploader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function PatientUpload() {
  return (
    <DashboardLayout 
      title="Upload MRI Scan" 
      subtitle="Upload your cardiac MRI for AI-powered analysis"
    >
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Upload Card */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Cardiac MRI Upload</CardTitle>
              <CardDescription>
                Upload your cardiac MRI scan for AI analysis. Supported formats include DICOM, PNG, and JPEG.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MRIUploader />
            </CardContent>
          </Card>
        </div>

        {/* Instructions Card */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upload Guidelines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">High Quality Scans</p>
                  <p className="text-sm text-muted-foreground">
                    Ensure your MRI scan is clear and high resolution for accurate analysis.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Recent Scans</p>
                  <p className="text-sm text-muted-foreground">
                    Use recent cardiac MRI scans (within the last 6 months) for best results.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Supported Formats</p>
                  <p className="text-sm text-muted-foreground">
                    PNG, JPEG, or DICOM files up to 50MB.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-warning/30 bg-warning/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-warning" />
                Important Notice
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This AI analysis is for screening purposes only and should not replace professional medical diagnosis. 
                Always consult with a qualified cardiologist for medical decisions.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}