import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { authApi, setToken } from '../../api/client';
import { PAKISTAN_CITIES } from '../../lib/constants';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';

export default function RegisterPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'register' | 'otp'>('register');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);

  function checkPassword(pw: string) {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    setPasswordStrength(s);
  }

  async function handleRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError('');
    try {
      await authApi.register({
        email: String(fd.get('email')),
        password: String(fd.get('password')),
        firstName: String(fd.get('firstName')),
        lastName: String(fd.get('lastName')),
        city: String(fd.get('city') ?? ''),
      });
      setEmail(String(fd.get('email')));
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const { token, user } = await authApi.verifyOtp(email, otp);
      setToken(token);
      setUser(user);
      navigate('/customer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid OTP');
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-[var(--shadow-card)]"
      >
        {step === 'otp' ? (
          <>
            <h1 className="font-display text-2xl font-bold text-brand">Verify Email</h1>
            <p className="mt-1 text-sm text-text-muted">OTP sent to {email}</p>
            <form onSubmit={handleVerify} className="mt-8 space-y-4">
              {error && <p className="text-sm text-warning">{error}</p>}
              <Input placeholder="6-digit OTP" maxLength={6} required value={otp} onChange={(e) => setOtp(e.target.value)} className="text-center tracking-widest" />
              <Button type="submit" variant="accent" className="w-full">Verify & Continue</Button>
            </form>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold text-brand">Create Account</h1>
            <form onSubmit={handleRegister} className="mt-8 space-y-4">
              {error && <p className="text-sm text-warning">{error}</p>}
              <div className="grid grid-cols-2 gap-3">
                <Input name="firstName" placeholder="First name" required />
                <Input name="lastName" placeholder="Last name" required />
              </div>
              <Input name="email" type="email" placeholder="Email" required />
              <div>
                <Input name="password" type="password" placeholder="Password (min 8)" minLength={8} required onChange={(e) => checkPassword(e.target.value)} />
                <div className="mt-2 flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full ${i <= passwordStrength ? 'bg-success' : 'bg-border'}`} />
                  ))}
                </div>
              </div>
              <Select name="city">
                <option value="">Select city</option>
                {PAKISTAN_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
              <Button type="submit" variant="accent" className="w-full">Register</Button>
            </form>
            <p className="mt-4 text-center text-sm text-text-muted">
              Already have an account? <Link to="/login" className="text-brand-light font-medium">Sign in</Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
