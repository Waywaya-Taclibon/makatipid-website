import Swal from 'sweetalert2';

export const cancelSwal = Swal.mixin({
    // Do not hand focus back to whatever was focused before opening: that
    // element often lives inside the world-map viewport, and re-focusing an
    // off-screen button scrolls the map out of position.
    returnFocus: false,
    customClass: {
        popup: 'rounded-2xl! font-sans',
        title: 'text-2xl! font-bold! text-slate-800! dark:text-slate-100!',
      },
    buttonsStyling: true,
    iconColor: '#e05d44',
    confirmButtonColor: '#e05d44',
})

export const bookedSwal = Swal.mixin({
    // See cancelSwal: focus restoration can scroll the map viewport.
    returnFocus: false,
    customClass: {
        popup: 'rounded-2xl! font-sans',
        title: 'text-2xl! font-bold! text-slate-800! dark:text-slate-100!',
      },
    buttonsStyling: true,
    iconColor: '#4a9e4a',
    confirmButtonColor: '#4a9e4a',
})