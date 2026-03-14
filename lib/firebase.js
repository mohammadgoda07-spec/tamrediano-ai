import { initializeApp, getApps } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { getFirestore, doc, setDoc, getDoc, collection, query, where, orderBy, getDocs, deleteDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:        process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:     process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  appId:         process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)
const googleProvider = new GoogleAuthProvider()

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider)
  return result.user
}
export async function logout() { await signOut(auth) }
export { auth, db }

export async function saveDocument(userId, toolId, title, html) {
  const ref = doc(collection(db, 'documents'))
  await setDoc(ref, { userId, toolId, title, html, createdAt: new Date().toISOString(), size: html.length })
  return ref.id
}
export async function getUserDocuments(userId) {
  const q = query(collection(db, 'documents'), where('userId', '==', userId), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
export async function deleteDocument(docId) { await deleteDoc(doc(db, 'documents', docId)) }
