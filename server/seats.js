import {randomUUID} from 'node:crypto';

const starts=['10:00','13:00','15:30','18:00'];
const dayMs=86400000;
const dateFormat=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',dateStyle:'short'});
const localDate=now=>dateFormat.format(now);
const times=(date,slot)=>{
  const start=Date.parse(`${date}T${slot}:00+08:00`);
  return {slot,starts_at:new Date(start).toISOString(),ends_at:new Date(start+7200000).toISOString()};
};
const columns='id,seat_code,starts_at,ends_at,cancelled_at';

export function registerSeatRoutes(app,db,{requireLogin,fail}) {
  const dateValue=value=>{
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))fail(400,'预约日期无效');
    const parsed=new Date(value+'T00:00:00Z');
    if(!Number.isFinite(+parsed)||parsed.toISOString().slice(0,10)!==value)fail(400,'预约日期无效');
    return value;
  };
  const slotValue=value=>{
    if(!starts.includes(value))fail(400,'预约时段无效');
    return value;
  };
  const bookingDates=now=>Array.from({length:7},(_,i)=>localDate(now+i*dayMs));
  const bookingDate=(value,dates)=>{
    const date=dateValue(value);
    if(!dates.includes(date))fail(400,'预约日期不在开放范围内');
    return date;
  };

  app.get('/api/seats',async(req,res)=>{
    const now=Date.now(),dates=bookingDates(now);
    const date=bookingDate(req.query.date??dates[0],dates);
    const slots=starts.map(slot=>times(date,slot));
    const [seats,reserved]=await Promise.all([
      db.all('SELECT code FROM seats ORDER BY code'),
      db.all('SELECT starts_at,seat_code FROM seat_reservations WHERE starts_at=ANY($1::timestamptz[]) AND cancelled_at IS NULL',[slots.map(s=>s.starts_at)])
    ]);
    res.json({date,dates,seats:seats.map(s=>s.code),slots:slots.map(slot=>({
      ...slot,open:Date.parse(slot.starts_at)>now,
      reserved:reserved.filter(r=>r.starts_at===slot.starts_at).map(r=>r.seat_code)
    }))});
  });

  app.get('/api/seat-reservations',requireLogin,async(req,res)=>{
    const reservations=await db.all(`SELECT ${columns} FROM seat_reservations WHERE user_id=$1 ORDER BY starts_at DESC,id`,[req.user.id]);
    res.json({now:new Date().toISOString(),reservations});
  });

  app.post('/api/seat-reservations',requireLogin,async(req,res)=>{
    const {date,slot,seat_code}=req.body??{};
    const when=times(bookingDate(date,bookingDates(Date.now())),slotValue(slot));
    if(typeof seat_code!=='string'||!await db.get('SELECT 1 FROM seats WHERE code=$1',[seat_code]))fail(400,'此座位不开放预约');
    try {
      const reservation=await db.get(`INSERT INTO seat_reservations(id,user_id,seat_code,starts_at,ends_at)
        SELECT $1,$2,$3,$4::timestamptz,$5 WHERE $4::timestamptz>clock_timestamp()
        RETURNING ${columns}`,[randomUUID(),req.user.id,seat_code,when.starts_at,when.ends_at]);
      if(!reservation)fail(409,'该时段已开始');
      res.status(201).json({reservation});
    } catch(error) {
      if(error.constraint==='active_seat_slot')fail(409,'该座位已被预约，请重新选座');
      if(error.constraint==='active_reader_slot')fail(409,'你在该时段已有预约');
      throw error;
    }
  });

  app.post('/api/seat-reservations/:id/cancel',requireLogin,async(req,res)=>{
    const params=[req.params.id,req.user.id];
    const changed=await db.run(`UPDATE seat_reservations SET cancelled_at=clock_timestamp()
      WHERE id=$1 AND user_id=$2 AND cancelled_at IS NULL AND starts_at>clock_timestamp()`,params);
    if(!changed) {
      if(!await db.get('SELECT 1 FROM seat_reservations WHERE id=$1 AND user_id=$2',params))fail(404,'预约不存在');
      fail(409,'该预约当前无法取消');
    }
    res.json({ok:true});
  });

  // The existing /api/admin middleware protects this route.
  app.get('/api/admin/seat-reservations',async(req,res)=>{
    const date=dateValue(req.query.date??localDate(Date.now()));
    const slot=slotValue(req.query.slot??starts[0]);
    const reservations=await db.all(`SELECT r.seat_code,u.name,
      CASE WHEN r.cancelled_at IS NULL THEN 'confirmed' ELSE 'cancelled' END AS status
      FROM seat_reservations r JOIN users u ON u.id=r.user_id WHERE r.starts_at=$1
      ORDER BY r.seat_code,r.cancelled_at NULLS FIRST,r.id`,[times(date,slot).starts_at]);
    res.json({date,slot,slots:starts,reservations});
  });
}
