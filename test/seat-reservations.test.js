import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './postgres-helper.js';
import {seatPoints} from '../public/js/seat-layout.js';

test('seat bookings use shared inventory, enforce ownership and persist through an upgrade and restart',async t=>{
  const f=await fixture({servers:2});
  t.after(()=>f.close());
  const register=async name=>{
    const response=await f.call('/api/auth/register',{method:'POST',body:{name,email:`${name}@example.test`,password:'seat-test-password'}});
    assert.equal(response.status,201);
    return response;
  };
  const [a,b,staff]=await Promise.all(['Reader-A','Reader-B','Staff'].map(register));
  await f.db.run("UPDATE users SET role='stuff' WHERE id=$1",[staff.data.user.id]);
  await f.db.transaction(async tx=>{
    await tx.run('DROP TABLE seat_reservations, seats');
    await tx.run('DELETE FROM schema_migrations WHERE version=6');
  });
  await f.restart();
  assert.equal((await f.call('/api/auth/me',{cookie:a.cookie})).data.user.name,'Reader-A');
  assert.ok((await f.call('/api/activities')).data.activities.length);

  const availability=await f.call('/api/seats');
  assert.equal(availability.status,200);
  const {date:today,dates,seats}=availability.data;
  assert.equal(dates.length,7);
  assert.equal(dates[0],new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',dateStyle:'short'}).format(new Date()));
  assert.deepEqual(seats,Object.keys(seatPoints));
  assert.equal(seats.length,23);
  for(const date of ['2026-02-30','2000-01-01'])assert.equal((await f.call(`/api/seats?date=${date}`)).status,400);
  const data={date:dates[1],slot:'10:00',seat_code:'A-01'};
  const book=(cookie,body=data,instance=0)=>f.call('/api/seat-reservations',{method:'POST',cookie,body,instance});
  const history=cookie=>f.call('/api/seat-reservations',{cookie});
  const cancel=(id,cookie)=>f.call(`/api/seat-reservations/${id}/cancel`,{method:'POST',cookie,body:{}});
  const list=(cookie,date=data.date,slot=data.slot)=>f.call(`/api/admin/seat-reservations?date=${date}&slot=${slot}`,{cookie});
  assert.equal((await book()).status,401);
  assert.equal((await history()).status,401);
  assert.equal((await list()).status,401);
  assert.equal((await book(a.cookie,{...data,seat_code:'C-01'})).status,400);
  assert.equal((await book(a.cookie,{...data,seat_code:'A-13'})).status,400);
  assert.equal((await book(a.cookie,{...data,slot:'10:30'})).status,400);
  assert.equal((await list(a.cookie)).status,403);

  const results=await Promise.all([book(a.cookie,data,0),book(b.cookie,data,1)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
  const winner=results.findIndex(r=>r.status===201),owner=[a,b][winner],other=[b,a][winner];
  const {id,starts_at,ends_at}=results[winner].data.reservation;
  assert.equal(starts_at,`${data.date}T02:00:00.000Z`);
  assert.equal(ends_at,`${data.date}T04:00:00.000Z`);
  assert.deepEqual((await history(other.cookie)).data.reservations,[]);
  assert.equal((await cancel(id,other.cookie)).status,404);
  assert.equal((await book(owner.cookie,{...data,seat_code:'A-02'})).status,409);
  assert.equal((await book(owner.cookie,{...data,slot:'13:00'})).status,201);
  const booked=await f.call(`/api/seats?date=${data.date}`);
  assert.deepEqual(booked.data.slots[0].reserved,['A-01']);
  assert.ok(!JSON.stringify(booked.data).includes(owner.data.user.name));
  assert.deepEqual((await list(staff.cookie)).data.reservations,[{seat_code:'A-01',name:owner.data.user.name,status:'confirmed'}]);
  assert.deepEqual((await list(staff.cookie,data.date,'15:30')).data.reservations,[]);

  assert.equal((await cancel(id,owner.cookie)).status,200);
  assert.equal((await cancel(id,owner.cookie)).status,409);
  assert.deepEqual((await f.call(`/api/seats?date=${data.date}`)).data.slots[0].reserved,[]);
  assert.equal((await book(other.cookie)).status,201);
  const past=availability.data.slots.find(s=>!s.open);
  if(past)assert.equal((await book(other.cookie,{...data,date:today,slot:past.slot})).status,409);
  await f.db.run(`INSERT INTO seat_reservations(id,user_id,seat_code,starts_at,ends_at)
    VALUES('past-seat',$1,'B-01',clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour')`,[other.data.user.id]);
  assert.equal((await cancel('past-seat',other.cookie)).status,409);
  await f.restart();
  assert.ok((await history(owner.cookie)).data.reservations.find(r=>r.id===id).cancelled_at);
  assert.equal((await list(staff.cookie)).data.reservations.length,2);
});
