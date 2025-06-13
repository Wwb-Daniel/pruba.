export async function generateThumbnail(videoBlob: Blob): Promise<Blob> {
  console.log('generateThumbnail: Iniciando generación de thumbnail...');
  
  return new Promise((resolve, reject) => {
    try {
      // Crear URL para el video
      const videoUrl = URL.createObjectURL(videoBlob);
      console.log('generateThumbnail: URL del video creada');

      // Crear elemento de video
      const video = document.createElement('video');
      video.src = videoUrl;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.crossOrigin = 'anonymous';

      // Configurar canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('No se pudo obtener el contexto del canvas');
      }

      let captureAttempts = 0;
      const MAX_ATTEMPTS = 3;

      // Función para capturar el frame
      const captureFrame = () => {
        try {
          if (video.videoWidth === 0 || video.videoHeight === 0) {
            console.log('generateThumbnail: Dimensiones del video inválidas', {
              width: video.videoWidth,
              height: video.videoHeight
            });
            return false;
          }

          // Ajustar tamaño del canvas
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          // Dibujar frame
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          // Verificar si el frame es válido (no está vacío)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const hasContent = imageData.data.some(pixel => pixel !== 0);
          
          if (!hasContent) {
            console.log('generateThumbnail: Frame capturado está vacío');
            return false;
          }

          // Convertir a blob
          canvas.toBlob(
            (blob) => {
              if (blob) {
                console.log('generateThumbnail: Thumbnail generado exitosamente', {
                  width: canvas.width,
                  height: canvas.height,
                  size: blob.size
                });
                resolve(blob);
              } else {
                reject(new Error('No se pudo generar el thumbnail'));
              }
            },
            'image/jpeg',
            0.8
          );
          return true;
        } catch (error) {
          console.error('generateThumbnail: Error al capturar frame:', error);
          return false;
        }
      };

      // Función para intentar capturar en diferentes momentos
      const tryCapture = () => {
        if (captureAttempts >= MAX_ATTEMPTS) {
          console.log('generateThumbnail: Máximo de intentos alcanzado');
          reject(new Error('No se pudo capturar un frame válido después de múltiples intentos'));
          return;
        }

        captureAttempts++;
        console.log(`generateThumbnail: Intento de captura ${captureAttempts}/${MAX_ATTEMPTS}`);

        // Intentar capturar en diferentes momentos del video
        const times = [0, 0.1, 0.5];
        const currentTime = times[captureAttempts - 1];
        
        video.currentTime = currentTime;
      };

      // Configurar eventos del video
      video.onloadeddata = () => {
        console.log('generateThumbnail: Video cargado completamente', {
          width: video.videoWidth,
          height: video.videoHeight,
          readyState: video.readyState
        });

        if (video.videoWidth > 0 && video.videoHeight > 0) {
          tryCapture();
        } else {
          console.log('generateThumbnail: Video cargado pero dimensiones inválidas');
          reject(new Error('El video no tiene dimensiones válidas'));
        }
      };

      video.onseeked = () => {
        console.log('generateThumbnail: Video seek completado, intentando capturar frame');
        if (!captureFrame()) {
          tryCapture();
        }
      };

      video.onerror = (error) => {
        console.error('generateThumbnail: Error al cargar el video:', error);
        reject(new Error('Error al cargar el video'));
      };

      // Configurar timeout
      const timeout = setTimeout(() => {
        console.error('generateThumbnail: Timeout después de 30 segundos');
        reject(new Error('Timeout: El proceso tomó demasiado tiempo'));
      }, 30000);

      // Limpiar recursos
      const cleanup = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(videoUrl);
        video.remove();
        canvas.remove();
        console.log('generateThumbnail: Recursos limpiados');
      };

      // Asegurar limpieza
      video.onended = cleanup;
      video.onerror = cleanup;

      // Cargar el video
      video.load();

    } catch (error) {
      console.error('generateThumbnail: Error general:', error);
      reject(error);
    }
  });
} 