import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { getRegisterUrl, resolvePostAuthRedirect } from '../../lib/authRedirect';
import { Logo } from '../../components/brand/Logo';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(resolvePostAuthRedirect(redirectTo, user.role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-[var(--shadow-card)]"
      >
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>
        <h1 className="mt-6 text-center font-display text-2xl font-bold text-brand">Welcome Back</h1>
        <p className="mt-1 text-sm text-text-muted">Sign in to your Crown Eve account</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-warning">{error}</p>}
          <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" variant="accent" className="w-full" loading={loading}>Sign In</Button>
        </form>

        <div className="mt-6 text-center text-sm text-text-muted space-y-2">
          <p><Link to="/forgot-password" className="text-brand-light hover:underline">Forgot password?</Link></p>
          <p>No account? <Link to={getRegisterUrl(redirectTo ?? undefined)} className="text-brand-light font-medium">Register</Link></p>
        </div>
      </motion.div>
    </div>
  );
}
