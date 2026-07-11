import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          navigate('/');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
        <h1 className="text-3xl font-bold mb-3">Payment Successful!</h1>
        <p className="text-muted-foreground mb-6">
          Welcome to the ladder! Your membership is now active. Redirecting to your dashboard in {countdown} seconds...
        </p>
        <Button
          onClick={() => navigate('/')}
          className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)]"
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}