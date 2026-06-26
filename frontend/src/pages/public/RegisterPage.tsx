import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { authApi, setToken } from '../../api/client';
import { getLoginUrl, resolvePostAuthRedirect } from '../../lib/authRedirect';
import { PAKISTAN_CITY_OPTIONS } from '../../lib/constants';
import { Logo } from '../../components/brand/Logo';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SearchSelect } from '../../components/ui/SearchSelect';

export default function RegisterPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  const [step, setStep] = useState<'register' | 'otp'>('register');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [city, setCity] = useState('');
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
        phone: String(fd.get('phone')),
        city: city.trim(),
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
      navigate(resolvePostAuthRedirect(redirectTo, user.role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid OTP');
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] w-full items-center justify-center bg-white px-4 py-16 lg:min-h-[calc(100dvh-6rem)]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-border-light bg-elevated p-8 shadow-[var(--shadow-elevated)]"
      >
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>
        {step === 'otp' ? (
          <>
            <h1 className="mt-6 text-center font-display text-2xl font-bold text-ink">Verify Email</h1>
            <p className="mt-1 text-sm text-ink-muted">OTP sent to {email}</p>
            <form onSubmit={handleVerify} className="mt-8 space-y-4">
              {error && <p className="text-sm text-warning">{error}</p>}
              <Input placeholder="6-digit OTP" maxLength={6} required value={otp} onChange={(e) => setOtp(e.target.value)} className="text-center tracking-widest" />
              <Button type="submit" variant="accent" className="w-full">Verify & Continue</Button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-center font-display text-2xl font-bold text-ink">Create Account</h1>
            <form onSubmit={handleRegister} className="mt-8 space-y-4">
              {error && <p className="text-sm text-warning">{error}</p>}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input name="firstName" placeholder="First name" required />
                <Input name="lastName" placeholder="Last name" required />
              </div>
              <Input name="email" type="email" placeholder="Email" required />
              <Input name="phone" type="tel" label="Phone" placeholder="+92 300 1234567" required />
              <div>
                <Input
                  name="password"
                  type="password"
                  passwordToggle
                  placeholder="Password (min 8)"
                  minLength={8}
                  required
                  onChange={(e) => checkPassword(e.target.value)}
                />
                <div className="mt-2 flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full ${i <= passwordStrength ? 'bg-success' : 'bg-border'}`} />
                  ))}
                </div>
              </div>
              <SearchSelect
                label="City"
                value={city}
                onChange={setCity}
                options={PAKISTAN_CITY_OPTIONS}
                placeholder="Search or type your city"
                allowCustom
              />
              <Button type="submit" variant="accent" className="w-full">Register</Button>
            </form>
            <p className="mt-4 text-center text-sm text-ink-muted">
              Already have an account? <Link to={redirectTo ? getLoginUrl(redirectTo) : '/login'} className="text-brand-light font-medium">Sign in</Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
