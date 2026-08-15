export function normalizeUsername(value:string){return value.trim().normalize("NFKC").toLocaleLowerCase("fa-IR");}
export function isValidUsername(value:string){return value.length>=3&&value.length<=24&&!/[\u0000-\u001f\u007f\s]/.test(value)&&/^[\p{L}\p{N}_.-]+$/u.test(value);}
