// Schematic coordinates, pending a walk-through with the store.
export const seatPoints=Object.fromEntries([
  ...Array.from({length:12},(_,i)=>[`A-${String(i+1).padStart(2,'0')}`,[91,218+32*i]]),
  ...Array.from({length:11},(_,i)=>[`B-${String(i+1).padStart(2,'0')}`,[543-20*i,300+30*i]])
]);
