// Auth com Firebase (email/senha)
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from './firebase.js';

// LOGIN (index.html)
document.getElementById('entrar')?.addEventListener('click', async (ev)=>{
  ev.preventDefault();
  const email = document.getElementById('email')?.value.trim();
  const senha = document.getElementById('senha')?.value;
  if(!email || !senha) return alert('Informe e-mail e senha.');
  try{
    await signInWithEmailAndPassword(auth, email, senha);
    location.href='home.html';
  }catch(err){
    console.error(err);
    alert('Não foi possível entrar: ' + (err.message || err));
  }
});

// CADASTRO (cadastro.html)
document.getElementById('logon')?.addEventListener('click', async (ev)=>{
  ev.preventDefault();
  const email = document.getElementById('email')?.value.trim();
  const senha = document.getElementById('senha')?.value;
  if(!email || !senha) return alert('Preencha e-mail e senha.');
  try{
    await createUserWithEmailAndPassword(auth, email, senha);
    location.href='home.html';
  }catch(err){
    console.error(err);
    alert('Não foi possível cadastrar: ' + (err.message || err));
  }
});
