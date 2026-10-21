'use client';

import { useEffect, useId, useState } from 'react';

type Candidate = { id:string; name:string; internalSku:string|null; internalBarcode:string|null };
type CatalogResponse = { ok?:boolean; code?:string; products?:Candidate[]; pagination?:{hasNext:boolean} };

/** Query-backed product selection for stock adjustments; no invisible catalog cutoff. */
export function StockProductPicker() {
  const inputId=useId();
  const listId=inputId+'-list';
  const helpId=inputId+'-help';
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState<Candidate|null>(null);
  const [options,setOptions]=useState<Candidate[]>([]);
  const [active,setActive]=useState(-1);
  const [open,setOpen]=useState(false);
  const [state,setState]=useState<'idle'|'loading'|'ready'|'error'>('idle');
  const [hasMore,setHasMore]=useState(false);

  useEffect(()=>{
    if(selected)return;
    const term=query.trim();
    if(term.length<3){setOptions([]);setState('idle');setOpen(false);return;}
    const controller=new AbortController();
    const timer=setTimeout(async()=>{
      setState('loading');
      try{
        const response=await fetch('/api/commerce/products?q='+encodeURIComponent(term),{
          cache:'no-store',signal:controller.signal,
        });
        const body=await response.json() as CatalogResponse;
        if(!response.ok||!body.ok)throw new Error(body.code||'LOOKUP_UNAVAILABLE');
        if(controller.signal.aborted)return;
        setOptions(body.products??[]);
        setHasMore(Boolean(body.pagination?.hasNext));
        setActive(-1);
        setOpen(true);
        setState('ready');
      }catch(error){
        if(controller.signal.aborted)return;
        setOptions([]);setOpen(false);setState('error');
      }
    },250);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[query,selected]);

  function choose(item:Candidate){
    setSelected(item);
    setQuery(item.name+(item.internalSku?' · '+item.internalSku:''));
    setOpen(false);
    setOptions([]);
    setActive(-1);
    setState('idle');
  }

  function onKeyDown(event:React.KeyboardEvent<HTMLInputElement>){
    if(event.key==='Escape'){setOpen(false);setActive(-1);return;}
    if(!options.length||!open)return;
    if(event.key==='ArrowDown'){event.preventDefault();setActive(index=>(index+1)%options.length);}
    if(event.key==='ArrowUp'){event.preventDefault();setActive(index=>index<=0?options.length-1:index-1);}
    if(event.key==='Enter'&&active>=0){event.preventDefault();choose(options[active]);}
  }

  return <div className="inventory-product-picker">
    <label htmlFor={inputId}>Ürün ara ve seç</label>
    <input id={inputId} className="input" type="search" role="combobox" aria-autocomplete="list"
      aria-controls={listId} aria-expanded={open&&options.length>0}
      aria-activedescendant={open&&active>=0?listId+'-'+active:undefined}
      aria-describedby={helpId} value={query} maxLength={80} autoComplete="off"
      placeholder="En az 3 karakter: ad, SKU veya barkod"
      onChange={event=>{setSelected(null);setQuery(event.target.value);setActive(-1);}}
      onFocus={()=>{if(options.length&&!selected)setOpen(true);}} onKeyDown={onKeyDown}/>
    <input type="hidden" name="productId" value={selected?.id??''}/>
    {selected?<div className="inventory-product-selected" role="status">
      <span><strong>Seçilen:</strong> {selected.name}{selected.internalSku?' · '+selected.internalSku:''}</span>
      <button className="action" type="button" onClick={()=>{setSelected(null);setQuery('');setOptions([]);setState('idle');}}>Değiştir</button>
    </div>:null}
    <div id={helpId} className="inventory-picker-help" aria-live="polite">
      {selected?'Stok hareketi seçilen ürün için kaydedilecek.'
       :state==='loading'?'Ürünler aranıyor…'
       :state==='error'?'Ürünler yüklenemedi. Aramayı tekrar deneyin.'
       :state==='ready'&&options.length===0?'Eşleşen ürün yok. Ad, SKU veya barkodu değiştirin.'
       :state==='ready'&&hasMore?'Birden fazla sonuç var; daha ayırt edici SKU veya barkod girin.'
       :'Stok hareketi kaydetmeden önce listeden bir ürün seçin.'}
    </div>
    {open&&options.length>0?<div id={listId} role="listbox" aria-label="Ürün arama sonuçları" className="inventory-picker-results">
      {options.slice(0,12).map((item,index)=>
        <button type="button" role="option" id={listId+'-'+index}
          aria-selected={index===active} className={'inventory-picker-option'+(index===active?' is-active':'')}
          key={item.id} onClick={()=>choose(item)}>
          <span>{item.name}</span><small>{item.internalSku??item.internalBarcode??'SKU belirtilmemiş'}</small>
        </button>)}
      {options.length>12?<span className="inventory-picker-overflow">Diğer sonuçlar için aramayı daraltın.</span>:null}
    </div>:null}
  </div>;
}
