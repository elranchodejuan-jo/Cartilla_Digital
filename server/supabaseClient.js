require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;
let createClient = null;

try {
    ({ createClient } = require('@supabase/supabase-js'));
} catch (err) {
    console.warn('Modulo @supabase/supabase-js no disponible. Las imagenes se guardaran como Base64 en la BD.');
}

if (createClient && supabaseUrl && supabaseAnonKey && supabaseUrl !== 'PENDIENTE_CONFIGURAR') {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log('Cliente de Supabase Storage inicializado correctamente.');
} else {
    console.warn('Supabase Storage no configurado. Las imagenes se guardaran como Base64 en la BD.');
}

module.exports = supabase;
