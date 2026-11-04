export async function readProductImage(file) {
  if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type)) throw Error('Choose a JPG, PNG or WebP image.');
  if (file.size > 8 * 1024 * 1024) throw Error('Choose an image smaller than 8 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('This image could not be opened. Choose another image.'));image.src=url;});
    const scale = Math.min(1,600 / Math.max(image.naturalWidth,image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Unable to prepare image.');
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    for(const quality of [.85,.65,.45]){
      const data=canvas.toDataURL('image/webp',quality);
      if(data.length<=400000)return data;
    }
    throw Error('Image is too detailed. Choose a smaller image.');
  }finally{URL.revokeObjectURL(url);}
}
