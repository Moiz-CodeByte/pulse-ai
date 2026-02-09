import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface PrescriptionFormProps {
  diagnosisId: string;
  onSuccess?: () => void;
}

export function PrescriptionForm({ diagnosisId, onSuccess }: PrescriptionFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    medicine: '',
    dosage: '',
    instructions: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('prescriptions')
        .insert({
          diagnosis_id: diagnosisId,
          doctor_id: user.id,
          medicine: formData.medicine,
          dosage: formData.dosage,
          instructions: formData.instructions,
          notes: formData.notes,
        });

      if (error) throw error;

      toast({
        title: 'Prescription Submitted',
        description: 'The prescription has been saved successfully.',
      });

      setFormData({ medicine: '', dosage: '', instructions: '', notes: '' });
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit prescription.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="medicine">Medicine Name *</Label>
          <Input
            id="medicine"
            placeholder="e.g., Aspirin, Metoprolol"
            value={formData.medicine}
            onChange={(e) => setFormData({ ...formData, medicine: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dosage">Dosage</Label>
          <Input
            id="dosage"
            placeholder="e.g., 100mg twice daily"
            value={formData.dosage}
            onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="instructions">Instructions</Label>
        <Textarea
          id="instructions"
          placeholder="Enter dosage instructions, timing, and any special notes..."
          value={formData.instructions}
          onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Additional Notes</Label>
        <Textarea
          id="notes"
          placeholder="Any additional notes or observations..."
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={2}
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Submit Prescription
          </>
        )}
      </Button>
    </form>
  );
}