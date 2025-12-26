import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { Link } from 'wouter';
import { API_BASE_URL } from '@/lib/api';

export default function PasswordRecovery() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/recover-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
      } else {
        console.error('❌ Password recovery failed:', data.message);
        setError(data.message || 'Error al enviar la solicitud');
      }
    } catch (err) {
      console.error('❌ Network error:', err);
      setError('Error de conexión. Verifica tu conexión a internet e inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              ¡Solicitud Enviada!
            </CardTitle>
            <CardDescription>
              Si el email existe en nuestro sistema, hemos enviado una nueva contraseña
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Mail className="h-4 w-4" />
              <AlertDescription>
                <strong>Revisa tu correo electrónico</strong><br />
                Te hemos enviado una nueva contraseña temporal a <strong>{email}</strong>
              </AlertDescription>
            </Alert>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">📧 ¿Qué hacer ahora?</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Revisa tu bandeja de entrada</li>
                <li>• Busca en la carpeta de spam si no aparece</li>
                <li>• Usa la nueva contraseña para iniciar sesión</li>
                <li>• Cambia la contraseña por una personal</li>
              </ul>
            </div>

            <div className="flex flex-col space-y-2">
              <Link href="/login">
                <Button className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver al Login
                </Button>
              </Link>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  setIsSuccess(false);
                  setEmail('');
                }}
              >
                Solicitar otra contraseña
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
            <Mail className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Recuperar Contraseña
          </CardTitle>
          <CardDescription>
            Ingresa tu email y te enviaremos una nueva contraseña temporal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">
                Correo Electrónico
              </label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="w-full"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || !email}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Enviar Nueva Contraseña
                </>
              )}
            </Button>

            <div className="text-center">
              <Link href="/login">
                <Button variant="ghost" className="text-sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver al Login
                </Button>
              </Link>
            </div>
          </form>

          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-900 mb-2">ℹ️ Información Importante</h4>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• Recibirás una contraseña temporal por email</li>
              <li>• Debes cambiarla después de iniciar sesión</li>
              <li>• La contraseña temporal es segura pero temporal</li>
              <li>• Si no recibes el email, revisa tu carpeta de spam</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
