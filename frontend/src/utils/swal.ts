import Swal from 'sweetalert2';

export const cancelSwal = Swal.mixin({
    customClass: {
        popup: 'rounded-2xl! font-sans',
        title: 'text-2xl! font-bold! text-slate-800!',
      },
    buttonsStyling: true,
    iconColor: '#e05d44',
    confirmButtonColor: '#e05d44',
})

export const bookedSwal = Swal.mixin({
    customClass: {
        popup: 'rounded-2xl! font-sans',
        title: 'text-2xl! font-bold! text-slate-800!',
      },
    buttonsStyling: true,
    iconColor: '#4a9e4a',
    confirmButtonColor: '#4a9e4a',
})