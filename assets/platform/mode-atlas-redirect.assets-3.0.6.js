(function(){
  'use strict';
  const destination=document.querySelector('link[rel="canonical"]');if(!destination)return;
  const target=new URL(new URL(destination.href).pathname,location.href);
  new URLSearchParams(location.search).forEach((value,key)=>{if(!['build','v','reload'].includes(key))target.searchParams.set(key,value);});
  target.hash=location.hash;location.replace(target.href);
})();
