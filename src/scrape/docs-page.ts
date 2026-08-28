/**
 * Downloads the HTML of the Bot API documentation page.
 *
 * @param url address of the page from the config
 * @returns source HTML
 * @throws when the server answers with anything other than 2xx
 */
export async function fetchDocsPage(url: string): Promise<string> {
  const response = await fetch(url, { headers: { accept: 'text/html' } });
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status} ${response.statusText}`);
  }
  return await response.text();
}
