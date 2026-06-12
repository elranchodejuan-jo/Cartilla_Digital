const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'PENDIENTE_CONFIGURAR') {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log('Cliente de Supabase Storage inicializado correctamente.');
} else {
    console.warn('⚠️  Supabase Storage no configurado. Las imágenes se guardarán como Base64 en la BD.');
}

module.exports = supabase;
