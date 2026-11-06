// Both the UI eligibility flags and submission checks use this policy.
export function feedbackEligibility(registration,now=Date.now()) {
 let state;
 if(registration.has_feedback)state='submitted';
 else if(registration.status==='cancelled')state='cancelled';
 else if(registration.status==='checked_in'||(registration.status==='confirmed'&&Date.parse(registration.end_time)<=now))state='available';
 else state='waiting';
 return {can_feedback:state==='available',feedback_state:state};
}
