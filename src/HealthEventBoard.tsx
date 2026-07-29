import{FormEvent,useEffect,useState}from"react";
import{CalendarDays,CheckCircle2,Clock,MapPin,Stethoscope,Users,X}from"lucide-react";
import{Link,useNavigate}from"react-router-dom";

type Slot={id:string;startTime:string;endTime:string;doctor:{id:string;user:{name:string};specialization:string}};
type BookingDoctor={id:string;user:{name:string};specialization:string};
type BoardEvent={id:string;name:string;description:string;location:string;address:string;eventDate:string;startTime:string;endTime:string;bannerImage?:string|null;maxCapacity:number;timeSlots:Slot[];bookingDoctors:BookingDoctor[];doctors:{doctor:BookingDoctor}[];_count:{appointments:number}};
const currentSession=()=>{try{return JSON.parse(localStorage.getItem("ln_session")||"null")}catch{return null}};

export default function HealthEventBoard({vertical=false}:{vertical?:boolean}={}){
  const navigate=useNavigate();
  const[events,setEvents]=useState<BoardEvent[]>([]);
  const[selected,setSelected]=useState<BoardEvent|null>(null);
  const[slotId,setSlotId]=useState("");
  const[doctorId,setDoctorId]=useState("");
  const[preferredStart,setPreferredStart]=useState("");
  const[preferredEnd,setPreferredEnd]=useState("");
  const[reason,setReason]=useState("");
  const[notice,setNotice]=useState("");
  const[busy,setBusy]=useState(false);
  const session=currentSession();
  const load=()=>fetch("/api/health-events",{cache:"no-store"}).then(r=>r.ok?r.json():[]).then((items:BoardEvent[])=>{setEvents(items);setSelected(current=>current?items.find(item=>item.id===current.id)||null:current);return items}).catch(()=>{setEvents([]);return [] as BoardEvent[]});
  useEffect(()=>{load()},[]);
  const book=async(event:FormEvent)=>{
    event.preventDefault();
    if(!selected||busy||!doctorId||(selected.timeSlots.length?!slotId:!preferredStart||!preferredEnd))return;
    setBusy(true);setNotice("");
    try{
      const response=await fetch(`/api/health-events/${selected.id}/appointments`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.token||""}`},body:JSON.stringify(selected.timeSlots.length?{slotId,reason:reason||null}:{doctorId,startTime:preferredStart,endTime:preferredEnd,reason:reason||null})});
      const result=await response.json();
      if(!response.ok){
        const message=result.error||"Could not make appointment";
        if(response.status===409)window.alert(message);
        throw new Error(message);
      }
      setNotice(result.status==="PENDING"?`Appointment request submitted for ${result.startTime}–${result.endTime}.`:`Appointment confirmed for ${result.startTime}–${result.endTime}.`);
      setSlotId("");setDoctorId("");setReason("");load();
      if(result.status==="CONFIRMED")navigate("/newsroom/appointments");
    }catch(error:any){setNotice(error.message)}
    finally{setBusy(false)}
  };
  if(!events.length)return null;
  return <section className={`healthStoryBoard latest${vertical?" vertical":""}`}>
    <div className="sectionTitle"><div><span>Talk With Doc</span><h2>Health events and appointments</h2></div><small>Published by the Local News health desk</small></div>
    <div className="healthBoardGrid">{events.map(item=><article key={item.id}>
      <div className={`healthBoardPhoto${item.bannerImage?" hasPhoto":""}`} style={item.bannerImage?{backgroundImage:`url(${item.bannerImage})`}:undefined}><span>HEALTH EVENT</span></div>
      <div className="healthBoardBody"><div className="healthBoardDate"><CalendarDays/>{new Date(item.eventDate).toLocaleDateString(undefined,{day:"numeric",month:"long",year:"numeric"})} · {item.startTime}–{item.endTime}</div><h3>{item.name}</h3><p>{item.description}</p><div className="healthBoardFacts"><span><MapPin/>{item.location}</span><span><Stethoscope/>{item.doctors.length} doctors</span><span><Users/>{item._count.appointments}/{item.maxCapacity}</span></div>
        {!session?<Link className="healthBookButton" to="/login" state={{from:"/"}}>Sign in to make appointment</Link>:<button className="healthBookButton" disabled={!item.bookingDoctors.length||item._count.appointments>=item.maxCapacity} onClick={()=>{setSelected(item);setNotice("");setSlotId("");setDoctorId("");setPreferredStart(item.startTime);setPreferredEnd(item.endTime)}}>{item._count.appointments>=item.maxCapacity?"Fully booked":item.bookingDoctors.length?"Make appointment":"No doctors available"}</button>}
      </div>
    </article>)}</div>
    {selected&&<div className="healthBookingBackdrop" onMouseDown={e=>e.target===e.currentTarget&&setSelected(null)}><form className="healthBookingModal" onSubmit={book}><header><div><small>MAKE APPOINTMENT</small><h2>{selected.name}</h2></div><button type="button" onClick={()=>setSelected(null)}><X/></button></header>{notice&&<div className={`healthBookingNotice${notice.startsWith("Appointment confirmed")||notice.startsWith("Appointment request")?" success":""}`}>{(notice.startsWith("Appointment confirmed")||notice.startsWith("Appointment request"))&&<CheckCircle2/>}{notice}</div>}<div className="healthBookingEventMeta"><span><CalendarDays/>{new Date(selected.eventDate).toLocaleDateString()}</span><span><MapPin/>{selected.location}</span></div><label>Doctor<select required value={doctorId} onChange={e=>{setDoctorId(e.target.value);setSlotId("")}}><option value="">Choose a doctor</option>{(selected.timeSlots.length?Array.from(new Map(selected.timeSlots.map(slot=>[slot.doctor.id,slot.doctor])).values()):selected.bookingDoctors).map(doctor=><option value={doctor.id} key={doctor.id}>{doctor.user.name} · {doctor.specialization}</option>)}</select></label>{selected.timeSlots.length?<label>Appointment slot<select required disabled={!doctorId} value={slotId} onChange={e=>setSlotId(e.target.value)}><option value="">{doctorId?"Choose an appointment time":"Choose a doctor first"}</option>{selected.timeSlots.filter(slot=>slot.doctor.id===doctorId).map(slot=><option value={slot.id} key={slot.id}>{slot.startTime}–{slot.endTime}</option>)}</select></label>:<><div className="healthPendingHint">No fixed slots are configured. Submit a preferred time for administrator confirmation.</div><div className="healthPreferredTimes"><label>Preferred start<input required type="time" value={preferredStart} onChange={e=>setPreferredStart(e.target.value)}/></label><label>Preferred end<input required type="time" value={preferredEnd} onChange={e=>setPreferredEnd(e.target.value)}/></label></div></>}<label>Reason for appointment (optional)<textarea rows={3} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Tell the doctor what you would like to discuss"/></label><div className="healthBookingActions"><button type="button" onClick={()=>setSelected(null)}>Cancel</button><button type="submit" disabled={busy||!doctorId||(selected.timeSlots.length?!slotId:!preferredStart||!preferredEnd)}><Clock/>{busy?"Submitting…":selected.timeSlots.length?"Confirm appointment":"Request appointment"}</button></div></form></div>}
  </section>;
}
