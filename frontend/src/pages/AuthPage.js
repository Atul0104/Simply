import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Home, Mail, Phone, Lock, User, Eye, EyeOff, MessageCircle, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState('login');
  const [loginMethod, setLoginMethod] = useState('password'); // password, otp
  const [loginData, setLoginData] = useState({ email: '', password: '', phone: '', otp: '' });
  const [registerData, setRegisterData] = useState({ email: '', password: '', confirmPassword: '', name: '', phone: '', role: 'customer' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // OTP states
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [otpMethod, setOtpMethod] = useState('sms'); // sms, whatsapp
  
  // Forgot password states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState(1); // 1: email, 2: otp, 3: new password
  
  // Validation states
  const [validationErrors, setValidationErrors] = useState({});
  
  const { login, register } = useAuth();
  const navigate = useNavigate();

  // OTP Timer countdown
  useEffect(() => {
    if (otpTimer > 0) {
      const timer = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpTimer]);

  // Validation functions
  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validatePhone = (phone) => {
    const re = /^[6-9]\d{9}$/;
    return re.test(phone);
  };

  const validatePassword = (password) => {
    // At least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
    return re.test(password);
  };

  const handlePhoneInput = (value, field, setter, data) => {
    // Only allow numbers
    const numbersOnly = value.replace(/\D/g, '').slice(0, 10);
    setter({ ...data, [field]: numbersOnly });
  };

  const handleOtpInput = (value, field, setter, data) => {
    // Only allow numbers, max 6 digits
    const numbersOnly = value.replace(/\D/g, '').slice(0, 6);
    setter({ ...data, [field]: numbersOnly });
  };

  // Send OTP for login
  const sendLoginOtp = async () => {
    if (!validatePhone(loginData.phone)) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/send-otp`, {
        phone: loginData.phone,
        method: otpMethod
      });
      setOtpSent(true);
      setOtpTimer(60);
      toast.success(`OTP sent via ${otpMethod === 'whatsapp' ? 'WhatsApp' : 'SMS'}!`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send OTP');
    }
    setLoading(false);
  };

  // Login with OTP
  const handleOtpLogin = async (e) => {
    e.preventDefault();
    if (!loginData.otp || loginData.otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/verify-otp-login`, {
        phone: loginData.phone,
        otp: loginData.otp
      });
      
      const { access_token, user } = response.data;
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      toast.success('Login successful!');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid OTP');
    }
    setLoading(false);
  };

  // Regular login
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setValidationErrors({});
    
    if (!validateEmail(loginData.email)) {
      setValidationErrors({ email: 'Please enter a valid email' });
      return;
    }
    
    if (!loginData.password) {
      setValidationErrors({ password: 'Password is required' });
      return;
    }
    
    setLoading(true);
    const result = await login(loginData.email, loginData.password);
    
    if (result.success) {
      toast.success('Login successful!');
      navigate('/');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  // Register with validation
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setValidationErrors({});
    
    const errors = {};
    
    if (!registerData.name || registerData.name.length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }
    
    if (!validateEmail(registerData.email)) {
      errors.email = 'Please enter a valid email';
    }
    
    if (!validatePhone(registerData.phone)) {
      errors.phone = 'Please enter a valid 10-digit phone number';
    }
    
    if (!validatePassword(registerData.password)) {
      errors.password = 'Password must be 8+ chars with uppercase, lowercase, number & special character';
    }
    
    if (registerData.password !== registerData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    
    setLoading(true);
    const result = await register(
      registerData.email,
      registerData.password,
      registerData.name,
      registerData.phone,
      registerData.role
    );
    
    if (result.success) {
      toast.success('Registration successful!');
      navigate('/');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  // Forgot password - Send OTP
  const sendForgotPasswordOtp = async () => {
    if (!validateEmail(forgotEmail)) {
      toast.error('Please enter a valid email');
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/forgot-password`, { email: forgotEmail });
      setForgotStep(2);
      setOtpTimer(60);
      toast.success('OTP sent to your email!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send OTP');
    }
    setLoading(false);
  };

  // Forgot password - Verify OTP
  const verifyForgotOtp = async () => {
    if (!forgotOtp || forgotOtp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/verify-reset-otp`, {
        email: forgotEmail,
        otp: forgotOtp
      });
      setForgotStep(3);
      toast.success('OTP verified!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid OTP');
    }
    setLoading(false);
  };

  // Forgot password - Reset password
  const resetPassword = async () => {
    if (!validatePassword(newPassword)) {
      toast.error('Password must be 8+ chars with uppercase, lowercase, number & special character');
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/reset-password`, {
        email: forgotEmail,
        otp: forgotOtp,
        new_password: newPassword
      });
      toast.success('Password reset successful! Please login.');
      setShowForgotPassword(false);
      setForgotStep(1);
      setForgotEmail('');
      setForgotOtp('');
      setNewPassword('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reset password');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      {/* Back/Home Button */}
      <Button
        variant="ghost"
        className="absolute top-4 left-4 gap-2 hover:bg-white/50"
        onClick={() => navigate('/')}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Button>
      
      <div className="w-full max-w-4xl grid gap-6 md:grid-cols-2">
        {/* Login Credentials Card */}
        <Card className="bg-gradient-to-br from-blue-600 to-purple-700 text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl text-white">🔑 Test Accounts</CardTitle>
            <CardDescription className="text-blue-100">Use these credentials to test different roles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 space-y-2 hover:bg-white/20 transition-colors">
              <p className="font-semibold text-lg">👤 Admin</p>
              <p className="font-mono text-sm">admin@marketplace.com</p>
              <p className="font-mono text-sm">admin123</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 space-y-2 hover:bg-white/20 transition-colors">
              <p className="font-semibold text-lg">🏪 Seller</p>
              <p className="font-mono text-sm">seller1@example.com</p>
              <p className="font-mono text-sm">seller123</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 space-y-2 hover:bg-white/20 transition-colors">
              <p className="font-semibold text-lg">🛒 Customer</p>
              <p className="font-mono text-sm">customer@example.com</p>
              <p className="font-mono text-sm">customer123</p>
            </div>
          </CardContent>
        </Card>

        {/* Auth Form Card */}
        <Card className="shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Welcome to Black Money
            </CardTitle>
            <CardDescription>Sign in to your account or create new one</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4" />
                {error}
              </motion.div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Login</TabsTrigger>
                <TabsTrigger value="register" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">Register</TabsTrigger>
              </TabsList>

              {/* Login Tab */}
              <TabsContent value="login">
                {/* Login Method Toggle */}
                <div className="flex gap-2 mb-4">
                  <Button
                    type="button"
                    variant={loginMethod === 'password' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setLoginMethod('password')}
                  >
                    <Lock className="w-4 h-4 mr-2" /> Password
                  </Button>
                  <Button
                    type="button"
                    variant={loginMethod === 'otp' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setLoginMethod('otp')}
                  >
                    <Phone className="w-4 h-4 mr-2" /> OTP
                  </Button>
                </div>

                {loginMethod === 'password' ? (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <Label className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-blue-600" /> Email
                      </Label>
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        value={loginData.email}
                        onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                        className={validationErrors.email ? 'border-red-500' : ''}
                      />
                      {validationErrors.email && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.email}</p>
                      )}
                    </div>
                    <div>
                      <Label className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-purple-600" /> Password
                      </Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter your password"
                          value={loginData.password}
                          onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                          className={validationErrors.password ? 'border-red-500 pr-10' : 'pr-10'}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {validationErrors.password && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.password}</p>
                      )}
                    </div>
                    
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    
                    <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700" disabled={loading}>
                      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Login
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleOtpLogin} className="space-y-4">
                    <div>
                      <Label className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-green-600" /> Phone Number
                      </Label>
                      <div className="flex gap-2">
                        <span className="flex items-center px-3 bg-gray-100 border rounded-l-md text-gray-600">+91</span>
                        <Input
                          type="tel"
                          placeholder="Enter 10-digit number"
                          value={loginData.phone}
                          onChange={(e) => handlePhoneInput(e.target.value, 'phone', setLoginData, loginData)}
                          className="rounded-l-none"
                          maxLength={10}
                        />
                      </div>
                    </div>
                    
                    {/* OTP Method Selection */}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={otpMethod === 'sms' ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1"
                        onClick={() => setOtpMethod('sms')}
                      >
                        <Phone className="w-4 h-4 mr-1" /> SMS
                      </Button>
                      <Button
                        type="button"
                        variant={otpMethod === 'whatsapp' ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => setOtpMethod('whatsapp')}
                      >
                        <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
                      </Button>
                    </div>
                    
                    {!otpSent ? (
                      <Button
                        type="button"
                        onClick={sendLoginOtp}
                        className="w-full"
                        disabled={loading || loginData.phone.length !== 10}
                      >
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Send OTP via {otpMethod === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                      </Button>
                    ) : (
                      <>
                        <div>
                          <Label className="flex items-center gap-2">
                            <Lock className="w-4 h-4 text-orange-600" /> Enter OTP
                          </Label>
                          <Input
                            type="text"
                            placeholder="Enter 6-digit OTP"
                            value={loginData.otp}
                            onChange={(e) => handleOtpInput(e.target.value, 'otp', setLoginData, loginData)}
                            className="text-center text-2xl tracking-widest"
                            maxLength={6}
                          />
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-sm text-gray-500">
                              {otpTimer > 0 ? `Resend in ${otpTimer}s` : ''}
                            </span>
                            {otpTimer === 0 && (
                              <button
                                type="button"
                                onClick={sendLoginOtp}
                                className="text-sm text-blue-600 hover:underline"
                              >
                                Resend OTP
                              </button>
                            )}
                          </div>
                        </div>
                        <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={loading || loginData.otp.length !== 6}>
                          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                          Verify & Login
                        </Button>
                      </>
                    )}
                  </form>
                )}
              </TabsContent>

              {/* Register Tab */}
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <Label className="flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-600" /> Full Name *
                    </Label>
                    <Input
                      placeholder="Enter your full name"
                      value={registerData.name}
                      onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                      className={validationErrors.name ? 'border-red-500' : ''}
                    />
                    {validationErrors.name && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.name}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-purple-600" /> Email *
                    </Label>
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      className={validationErrors.email ? 'border-red-500' : ''}
                    />
                    {validationErrors.email && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.email}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-green-600" /> Phone Number *
                    </Label>
                    <div className="flex gap-2">
                      <span className="flex items-center px-3 bg-gray-100 border rounded-l-md text-gray-600">+91</span>
                      <Input
                        type="tel"
                        placeholder="Enter 10-digit number"
                        value={registerData.phone}
                        onChange={(e) => handlePhoneInput(e.target.value, 'phone', setRegisterData, registerData)}
                        className={`rounded-l-none ${validationErrors.phone ? 'border-red-500' : ''}`}
                        maxLength={10}
                      />
                    </div>
                    {validationErrors.phone && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.phone}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-orange-600" /> Password *
                    </Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Create a strong password"
                        value={registerData.password}
                        onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                        className={`pr-10 ${validationErrors.password ? 'border-red-500' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {validationErrors.password && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.password}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">Min 8 chars, uppercase, lowercase, number & special char</p>
                  </div>
                  
                  <div>
                    <Label className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-red-600" /> Confirm Password *
                    </Label>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Confirm your password"
                        value={registerData.confirmPassword}
                        onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                        className={`pr-10 ${validationErrors.confirmPassword ? 'border-red-500' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {validationErrors.confirmPassword && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.confirmPassword}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label>Register as</Label>
                    <Select value={registerData.role} onValueChange={(v) => setRegisterData({ ...registerData, role: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">🛒 Customer</SelectItem>
                        <SelectItem value="seller">🏪 Seller</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Create Account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              {forgotStep === 1 && 'Enter your email to receive a password reset OTP'}
              {forgotStep === 2 && 'Enter the OTP sent to your email'}
              {forgotStep === 3 && 'Create a new password'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {forgotStep === 1 && (
              <div>
                <Label>Email Address</Label>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                />
              </div>
            )}
            
            {forgotStep === 2 && (
              <div>
                <Label>Enter OTP</Label>
                <Input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={forgotOtp}
                  onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center text-2xl tracking-widest"
                  maxLength={6}
                />
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm text-gray-500">
                    {otpTimer > 0 ? `Resend in ${otpTimer}s` : ''}
                  </span>
                  {otpTimer === 0 && (
                    <button
                      type="button"
                      onClick={sendForgotPasswordOtp}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Resend OTP
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {forgotStep === 3 && (
              <div>
                <Label>New Password</Label>
                <Input
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">Min 8 chars, uppercase, lowercase, number & special char</p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForgotPassword(false); setForgotStep(1); }}>
              Cancel
            </Button>
            {forgotStep === 1 && (
              <Button onClick={sendForgotPasswordOtp} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Send OTP
              </Button>
            )}
            {forgotStep === 2 && (
              <Button onClick={verifyForgotOtp} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Verify OTP
              </Button>
            )}
            {forgotStep === 3 && (
              <Button onClick={resetPassword} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Reset Password
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
