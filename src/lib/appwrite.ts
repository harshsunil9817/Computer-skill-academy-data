
import { Client, Storage, ID } from 'appwrite';

const APPWRITE_PROJECT_ID = '6853dd55001a7319d739';
const APPWRITE_API_ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
export const APPWRITE_STUDENT_PHOTOS_BUCKET_ID = '6853e8b3000f76da7c06';

const client = new Client();

client
    .setEndpoint(APPWRITE_API_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID);

const storage = new Storage(client);

export { client, storage, ID };
