export function whatsappPhone(phone:string){
  const digits=phone.replace(/\D/g,'');
  if(!digits)return'';
  return digits.startsWith('0')?`60${digits.slice(1)}`:digits;
}

export function whatsappInviteUrl({phone,recipientName,inviterName,origin}:{phone:string;recipientName:string;inviterName:string;origin:string}){
  const number=whatsappPhone(phone);
  if(!number)return'';
  const loginUrl=`${origin.replace(/\/$/,'')}/login`;
  const message=`Hello ${recipientName}, ${inviterName} invited you to sign in to Local News. 您受邀登录本地新闻。 ${loginUrl}`;
  return`https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
