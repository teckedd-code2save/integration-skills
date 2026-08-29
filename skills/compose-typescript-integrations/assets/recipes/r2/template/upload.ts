export async function uploadToPresignedUrl(input: {
  url: string;
  file: Blob;
  contentType: string;
}) {
  const response = await fetch(input.url, {
    method: "PUT",
    headers: { "Content-Type": input.contentType },
    body: input.file,
  });
  if (!response.ok) throw new Error(`R2 upload failed (${response.status})`);
}
