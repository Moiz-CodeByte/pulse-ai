import { Link, useNavigate } from 'react-router-dom';
import { Heart, Activity, Shield, Zap, Users, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

const features = [
  {
    icon: Activity,
    title: 'AI-Powered Diagnosis',
    description: 'Advanced machine learning algorithms analyze cardiac MRI scans with high accuracy to detect heart disease patterns.',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    description: 'Your medical data is encrypted and protected with enterprise-grade security. HIPAA compliant infrastructure.',
  },
  {
    icon: Zap,
    title: 'Instant Results',
    description: 'Get risk assessment results in minutes, not days. Accelerate your cardiac health monitoring.',
  },
  {
    icon: Users,
    title: 'Doctor Collaboration',
    description: 'Connect with verified cardiologists who can review your results and provide personalized prescriptions.',
  },
];

const stats = [
  { value: '99.2%', label: 'Accuracy Rate' },
  { value: '50K+', label: 'Scans Analyzed' },
  { value: '500+', label: 'Verified Doctors' },
  { value: '<2min', label: 'Average Analysis Time' },
];

export default function Landing() {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && userRole) {
      const redirectPath = userRole === 'admin' ? '/admin' : userRole === 'doctor' ? '/doctor' : '/patient';
      navigate(redirectPath);
    }
  }, [user, userRole, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-24 pb-16 lg:pt-32 lg:pb-24 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-bl from-primary/5 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-gradient-to-tr from-primary/5 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6 animate-fade-in">
              <Heart className="h-4 w-4 text-primary animate-heartbeat" />
              <span className="text-sm font-medium text-primary">AI-Powered Cardiac Care</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-foreground leading-tight animate-fade-in">
              Detect Heart Disease
              <br />
              <span className="text-primary">Before It's Too Late</span>
            </h1>

            {/* Subheadline */}
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in">
              Upload your cardiac MRI scan and receive instant AI-powered risk assessment. 
              Connect with verified cardiologists for personalized treatment plans.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in">
              <Link to="/auth?mode=register">
                <Button size="lg" className="gap-2 shadow-primary text-lg px-8">
                  Get Started Free
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/auth">
                <Button variant="outline" size="lg" className="text-lg px-8">
                  Sign In
                </Button>
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground animate-fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>HIPAA Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>256-bit Encryption</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>FDA Cleared AI</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-muted/30 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl sm:text-4xl font-display font-bold text-primary">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground">
              Why Choose Pulse AI?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Combining cutting-edge AI technology with world-class medical expertise to revolutionize cardiac care.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300 group"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="about" className="py-16 lg:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Three simple steps to get your cardiac health assessment.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: '1', title: 'Upload MRI', description: 'Simply upload your cardiac MRI scan through our secure platform.' },
              { step: '2', title: 'AI Analysis', description: 'Our advanced AI analyzes your scan and generates a risk assessment.' },
              { step: '3', title: 'Get Results', description: 'Receive your diagnosis and connect with a cardiologist for treatment.' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mb-4">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center p-8 sm:p-12 rounded-2xl bg-gradient-primary text-primary-foreground">
            <Heart className="h-12 w-12 mx-auto mb-4 animate-heartbeat" />
            <h2 className="text-2xl sm:text-3xl font-display font-bold mb-4">
              Take Control of Your Heart Health Today
            </h2>
            <p className="text-lg opacity-90 mb-8">
              Join thousands of patients who have gained peace of mind with AI-powered cardiac screening.
            </p>
            <Link to="/auth?mode=register">
              <Button size="lg" variant="secondary" className="gap-2 text-lg px-8">
                Start Your Free Assessment
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              <span className="font-display font-semibold text-foreground">Pulse AI</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 Pulse AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}