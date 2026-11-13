export const PASSWORD_MIN_LENGTH=6;
export const PASSWORD_MAX_LENGTH=128;
export const PASSWORD_LENGTH_RANGE=`${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} 个字符`;

export function hasValidPasswordLength(value){
 return typeof value==='string'&&value.length>=PASSWORD_MIN_LENGTH&&value.length<=PASSWORD_MAX_LENGTH;
}
