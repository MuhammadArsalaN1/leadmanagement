import { db } from "../firebase/firebase";
import {
  collection,
  getDocs,
  updateDoc,
  doc
} from "firebase/firestore";

export const rolloverTodos = async () => {

  const today = new Date();
  const yesterday =
    new Date(today.setDate(today.getDate()-1))
      .toISOString().slice(0,10);

  const snap = await getDocs(collection(db,"todos"));

  snap.forEach(async d => {

    const t = d.data();

    // if yesterday + not done → move to today
    if (t.date === yesterday && !t.done) {

      await updateDoc(doc(db,"todos",d.id),{
        date: new Date().toISOString().slice(0,10)
      });

    }

  });

};
