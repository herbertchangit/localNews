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

export function whatsappEventInvitationUrl({phone,recipientName,inviterName,eventName,shareUrl}:{phone:string;recipientName:string;inviterName:string;eventName:string;shareUrl:string}){
  const number=whatsappPhone(phone);
  if(!number)return'';
  const message=`Hello ${recipientName}, ${inviterName} invited you to ${eventName}. Register here: ${shareUrl}`;
  return`https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function whatsappParkingPassUrl({phone,visitorName,carPlateNumber,shareUrl}:{phone:string;visitorName:string;carPlateNumber:string;shareUrl:string}){
  const number=whatsappPhone(phone);
  if(!number)return'';
  const message=`Hello ${visitorName}, your electronic Parking Pass for vehicle ${carPlateNumber} is ready. Show this pass on arrival: ${shareUrl}`;
  return`https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
