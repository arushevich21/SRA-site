import { redirect } from 'next/navigation';

// The store lives on Exclaim, not on this site — send visitors straight
// there instead of showing an intermediate "click to open in a new tab" page.
export default function StorePage() {
  redirect('https://exclaim.gg/store/simracingalliance');
}
