export const activitySelect = `SELECT a.id,a.title,a.category,a.description,a.start_time,a.end_time,
 a.location,a.capacity,a.fee_cents,a.publish_status,
 (SELECT COALESCE(SUM(headcount),0)::integer FROM registrations r
 WHERE r.activity_id=a.id AND r.status IN ('confirmed','checked_in')) AS enrolled_count FROM activities a`;
export const privateRegistrations = `SELECT r.id,r.activity_id,r.ticket_code,r.status,r.phone,r.headcount,
 r.created_at,r.cancelled_at,a.title,a.start_time,a.end_time,a.location,
 EXISTS(SELECT 1 FROM feedbacks f WHERE f.registration_id=r.id) AS has_feedback
 FROM registrations r JOIN activities a ON a.id=r.activity_id WHERE r.user_id=$1 ORDER BY r.created_at DESC,r.id`;
// Count in a separate statement AFTER acquiring the lock: READ COMMITTED sees the latest commit.
export const lockActivity = (tx,id)=>tx.get('SELECT * FROM activities WHERE id=$1 FOR UPDATE',[id]);
export async function enrollmentCount(tx,id) {
 return (await tx.get(`SELECT COALESCE(SUM(headcount),0)::integer AS n FROM registrations
 WHERE activity_id=$1 AND status IN ('confirmed','checked_in')`,[id])).n;
}
