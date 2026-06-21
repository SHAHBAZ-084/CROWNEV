import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleEmail(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await authApi.forgotPassword(email);
      setMessage('If the email exists, an OTP has been sent.');
      setStep('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function handleReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError('');
    try {
      await authApi.resetPassword(email, String(fd.get('otp')), String(fd.get('password')));
      setMessage('Password reset! You can now sign in.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-2xl font-bold text-brand">Reset Password</h1>
      {step === 'email' ? (
        <form onSubmit={handleEmail} className="mt-6 space-y-4">
          {error && <p className="text-sm text-warning">{error}</p>}
          <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" variant="accent" className="w-full">Send OTP</Button>
        </form>
      ) : (
        <form onSubmit={handleReset} className="mt-6 space-y-4">
          {message && <p className="text-sm text-success">{message}</p>}
          {error && <p className="text-sm text-warning">{error}</p>}
          <Input name="otp" placeholder="6-digit OTP" maxLength={6} required />
          <Input name="password" type="password" placeholder="New password" minLength={8} required />
          <Button type="submit" variant="accent" className="w-full">Reset Password</Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm"><Link to="/login" className="text-brand-light">← Back to login</Link></p>
    </div>
  );
}
