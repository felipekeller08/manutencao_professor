// Enviar e-mail de redefinição
import { auth, sendPasswordResetEmail } from './firebase.js';

document.getElementById('redefinir')?.addEventListener('click', async (ev)=>{
  ev.preventDefault();
  const email = document.getElementById('email')?.value.trim();
  if(!email) return alert('Informe seu e-mail.');
  try{
    await sendPasswordResetEmail(auth, email);
    alert('Enviamos um e-mail com o link de redefinição.');
  }catch(err){
    console.error(err);
    alert('Erro ao enviar link: ' + (err.message || err));
  }
});
