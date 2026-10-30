import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password, hash) {
  const [salt, expected] = hash.split(':');
  const key = await derive(password, salt, 64);
  const buffer = Buffer.from(expected, 'hex');
  return key.length === buffer.length && timingSafeEqual(key, buffer);
}
export function publicUser(u) { return u ? { id:u.id, name:u.name, email:u.email, role:u.role } : null; }
export async function createSession(db, userId, res, cookieName='sanlian_session', {secure=process.env.NODE_ENV==='production'}={}) {
  const token = randomBytes(32).toString('hex');
  await db.run('DELETE FROM sessions WHERE expires_at < $1',[Date.now()]);
  await db.run('INSERT INTO sessions VALUES ($1,$2,$3)',[tokenHash(token), userId, Date.now()+7*86400000]);
  res.cookie(cookieName, token, {httpOnly:true, sameSite:'lax', secure, maxAge:7*86400000, path:'/'});
}
export function sessionMiddleware(db, cookieName='sanlian_session') {
  return async (req,res,next) => {
    const token = (req.headers.cookie || '').split(';').map(v=>v.trim()).find(v=>v.startsWith(`${cookieName}=`))?.slice(cookieName.length+1);
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      req.sessionHash = tokenHash(token);
      req.user = await db.get(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
        WHERE s.token_hash=$1 AND s.expires_at>$2 AND u.is_active=1`,[req.sessionHash,Date.now()]);
    }
    next();
  };
}
