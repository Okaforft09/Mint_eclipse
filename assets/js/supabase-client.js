
const SUPABASE_URL =
  'https://qjjmzymludnoksquildz.supabase.co';

const SUPABASE_PUBLIC_KEY =
  'sb_publishable_245QfoxGXvXcGhN69DuJ2Q_6n0wacaP';

if (!window.supabase) {
  console.error('Supabase CDN library is not loaded.');
} else {
  window.supabaseClient =
    window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLIC_KEY
    );

  console.log('Supabase client created successfully');
}