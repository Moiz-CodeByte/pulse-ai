import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Heart, Mail, Lock, User, Loader2, ArrowLeft, Stethoscope, ShieldCheck, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { AppLogo } from '@/components/ui/AppLogo';

type AppRole = 'patient' | 'doctor' | 'admin';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Name must be at least 2 characters').optional(),
});

export default function Auth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signIn, signUp, user, userRole } = useAuth();
  const { toast } = useToast();

  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'register');
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole>('patient');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (user && userRole) {
      const redirectPath = userRole === 'admin' ? '/admin' : userRole === 'doctor' ? '/doctor' : '/patient';
      navigate(redirectPath);
    }
  }, [user, userRole, navigate]);

  const validateForm = () => {
    try {
      if (isLogin) {
        authSchema.pick({ email: true, password: true }).parse(formData);
      } else {
        authSchema.parse({ ...formData, fullName: formData.fullName });
      }
      setErrors({});
      return true;
    } catch (err: any) {
      const newErrors: { [key: string]: string } = {};
      err.errors?.forEach((e: any) => {
        newErrors[e.path[0]] = e.message;
      });
      setErrors(newErrors);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          toast({
            title: 'Sign In Failed',
            description: error.message === 'Invalid login credentials' 
              ? 'Invalid email or password. Please try again.'
              : error.message,
            variant: 'destructive',
          });
        }
      } else {
        const { error } = await signUp(formData.email, formData.password, formData.fullName, selectedRole);
        if (error) {
          const errorMessage = error.message.includes('already registered')
            ? 'This email is already registered. Please sign in instead.'
            : error.message;
          toast({
            title: 'Registration Failed',
            description: errorMessage,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Registration Successful!',
            description: selectedRole === 'doctor' 
              ? 'Your account has been created. Please complete your professional profile.'
              : 'Your account has been created. You can now sign in.',
          });
          if (selectedRole === 'doctor') {
            // Doctor registered - sign them in and redirect to complete profile
            const { error: signInError } = await signIn(formData.email, formData.password);
            if (!signInError) {
              navigate('/doctor/complete-profile');
            }
          } else {
            setIsLogin(true);
          }
        }
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { value: 'patient' as AppRole, label: 'Patient', icon: UserCircle, description: 'Upload scans and get diagnosis' },
    { value: 'doctor' as AppRole, label: 'Doctor', icon: Stethoscope, description: 'Review cases and prescribe' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Back Button */}
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <AppLogo className="animate-heartbeat" />
            <span className="text-2xl font-display font-bold text-primary">Pulse AI</span>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-display font-bold text-foreground">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {isLogin 
                ? 'Sign in to access your cardiac health dashboard.'
                : 'Start your journey to better heart health today.'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
              <>
                {/* Role Selection */}
                <div className="space-y-3">
                  <Label>I am a...</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {roles.map((role) => (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => setSelectedRole(role.value)}
                        className={`p-4 rounded-lg border-2 text-center transition-all ${
                          selectedRole === role.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <role.icon className={`h-6 w-6 mx-auto mb-2 ${
                          selectedRole === role.value ? 'text-primary' : 'text-muted-foreground'
                        }`} />
                        <p className={`text-sm font-medium ${
                          selectedRole === role.value ? 'text-primary' : 'text-foreground'
                        }`}>
                          {role.label}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Full Name */}
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      placeholder="Enter your full name"
                      className="pl-10"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    />
                  </div>
                  {errors.fullName && (
                    <p className="text-sm text-destructive">{errors.fullName}</p>
                  )}
                </div>
              </>
            )}

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  className="pl-10"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  className="pl-10"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            {/* Submit Button */}
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isLogin ? 'Signing in...' : 'Creating account...'}
                </>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </Button>
          </form>

          {/* Toggle Mode */}
          <p className="mt-8 text-center text-muted-foreground">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setErrors({});
              }}
              className="ml-2 text-primary font-medium hover:underline"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>

          <div className="mt-4 text-center">
            <Link to="/doctors" className="text-sm font-medium text-primary hover:underline">
              Browse Verified Cardiologists
            </Link>
          </div>
        </div>
      </div>

      {/* Right Panel - Decorative */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-primary p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full border-4 border-white animate-pulse-slow" />
          <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full border-4 border-white animate-pulse-slow" style={{ animationDelay: '1s' }} />
        </div>
        
        <div className="relative z-10 text-center text-primary-foreground">
          <Heart className="h-24 w-24 mx-auto mb-8 animate-heartbeat" />
          <h2 className="text-3xl font-display font-bold mb-4">
            Your Heart Health Partner
          </h2>
          <p className="text-lg opacity-90 max-w-md">
            Advanced AI-powered cardiac MRI analysis to detect heart disease early and connect you with expert cardiologists.
          </p>
        </div>
      </div>
    </div>
  );
}
