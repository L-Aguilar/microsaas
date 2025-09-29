import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // LOGIN with Supabase Auth
  if (req.query.email && req.query.password) {
    const email = req.query.email;
    const password = req.query.password;

    try {
      // Initialize Supabase client with auth
      const supabase = createClient(
        process.env.SUPABASE_URL || 'https://qzwilvlxfuievcnfsntk.supabase.co',
        process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY
      );

      // Use Supabase Auth to sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        console.error('Supabase Auth error:', error);
        return res.status(401).json({ 
          message: 'Invalid email or password',
          supabaseError: error.message 
        });
      }

      if (!data.user) {
        return res.status(401).json({ message: 'Authentication failed' });
      }

      // Get additional user data from our users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (userError) {
        console.error('User data error:', userError);
        // Still return successful auth even if user table query fails
      }

      return res.status(200).json({
        success: true,
        user: userData || {
          id: data.user.id,
          email: data.user.email,
          role: 'USER'
        },
        session: {
          access_token: data.session?.access_token,
          expires_at: data.session?.expires_at
        },
        message: 'Supabase Auth successful',
        authMethod: 'supabase-auth'
      });

    } catch (error) {
      console.error('Auth error:', error);
      return res.status(500).json({ 
        message: 'Authentication error',
        error: error.message 
      });
    }
  }

  // Default behavior - show available auth methods
  return res.status(400).json({
    message: 'Please provide email and password',
    usage: 'Add ?email=your@email.com&password=yourpassword for Supabase Auth',
    availableEndpoints: {
      'supabase_auth': '/api/auth-supabase?email=...&password=...',
      'database_direct': '/api/test-supabase?email=...&password=...'
    }
  });
}