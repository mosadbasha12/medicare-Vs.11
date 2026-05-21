import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { COLORS } from '../theme';
import { useUser } from '../context/UserContext';
import { db } from '../services/firebase';

const getRoomId = (appointmentId?: string, fallbackRoom?: string) =>
  (fallbackRoom || (appointmentId ? `medicare-${appointmentId}` : `medicare-${Date.now()}`)).replace(/[^\w-]/g, '-');

export default function VideoCallScreen({ navigation, route }: any) {
  const { user } = useUser();
  const roomId = useMemo(() => getRoomId(route?.params?.appointmentId, route?.params?.meetingRoom), [route?.params?.appointmentId, route?.params?.meetingRoom]);
  const initiatorId = route?.params?.initiatorId || route?.params?.callerId;
  const isCaller = Boolean(user?.uid && initiatorId && user.uid === initiatorId);
  const localVideoRef = useRef<any>(null);
  const remoteVideoRef = useRef<any>(null);
  const pcRef = useRef<any>(null);
  const localStreamRef = useRef<any>(null);
  const [status, setStatus] = useState('جاري تجهيز المكالمة...');
  const [error, setError] = useState('');

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    if (typeof window === 'undefined' || !(navigator as any)?.mediaDevices?.getUserMedia || !(window as any).RTCPeerConnection) {
      setError('المتصفح الحالي لا يدعم مكالمات الفيديو المباشرة.');
      return undefined;
    }

    let closed = false;
    let handledOffer = false;
    const unsubscribers: Array<() => void> = [];
    const callRef = doc(db, 'videoCalls', roomId);
    const offerCandidatesRef = collection(db, 'videoCalls', roomId, 'offerCandidates');
    const answerCandidatesRef = collection(db, 'videoCalls', roomId, 'answerCandidates');
    const peerConnection = new (window as any).RTCPeerConnection({
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
      ],
    });
    pcRef.current = peerConnection;

    const stopCall = () => {
      localStreamRef.current?.getTracks?.().forEach((track: any) => track.stop());
      peerConnection.close();
    };

    const startCall = async () => {
      try {
        await setDoc(callRef, {
          roomId,
          appointmentId: route?.params?.appointmentId || '',
          initiatorId: initiatorId || user?.uid || '',
          updatedAt: serverTimestamp(),
        }, { merge: true });

        const localStream = await (navigator as any).mediaDevices.getUserMedia({ video: true, audio: true });
        const remoteStream = new MediaStream();
        localStreamRef.current = localStream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
          localVideoRef.current.muted = true;
          localVideoRef.current.playsInline = true;
        }
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.playsInline = true;
        }

        localStream.getTracks().forEach((track: any) => peerConnection.addTrack(track, localStream));
        peerConnection.ontrack = (event: any) => {
          event.streams?.[0]?.getTracks?.().forEach((track: any) => remoteStream.addTrack(track));
          setStatus('المكالمة متصلة');
        };
        peerConnection.onconnectionstatechange = () => {
          const state = peerConnection.connectionState;
          if (state === 'connected') setStatus('المكالمة متصلة');
          if (state === 'disconnected') setStatus('تم قطع الاتصال مؤقتا، جاري إعادة المحاولة...');
          if (state === 'failed') setStatus('تعذر الاتصال. حاول إنهاء المكالمة والبدء مرة أخرى.');
        };
        peerConnection.onicecandidate = async (event: any) => {
          if (event.candidate) {
            await addDoc(isCaller ? offerCandidatesRef : answerCandidatesRef, event.candidate.toJSON());
          }
        };

        if (isCaller) {
          setStatus('في انتظار قبول الطرف الآخر...');
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          await setDoc(callRef, {
            offer: { type: offer.type, sdp: offer.sdp },
            initiatorId: user?.uid || initiatorId || '',
            updatedAt: serverTimestamp(),
          }, { merge: true });

          unsubscribers.push(onSnapshot(callRef, async (snapshot) => {
            const data = snapshot.data();
            if (!closed && data?.answer && !peerConnection.currentRemoteDescription) {
              await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
              setStatus('جاري الاتصال...');
            }
          }));
          unsubscribers.push(onSnapshot(answerCandidatesRef, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') peerConnection.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(() => undefined);
            });
          }));
        } else {
          setStatus('جاري الدخول إلى المكالمة...');
          unsubscribers.push(onSnapshot(callRef, async (snapshot) => {
            const data = snapshot.data();
            if (closed || handledOffer || !data?.offer) return;
            handledOffer = true;
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            await setDoc(callRef, {
              answer: { type: answer.type, sdp: answer.sdp },
              acceptedBy: user?.uid || '',
              updatedAt: serverTimestamp(),
            }, { merge: true });
            setStatus('جاري الاتصال...');
          }));
          unsubscribers.push(onSnapshot(offerCandidatesRef, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') peerConnection.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(() => undefined);
            });
          }));
        }
      } catch (err) {
        console.error('Video call setup error:', err);
        setError('تعذر تشغيل الكاميرا أو الميكروفون. تأكد من السماح للمتصفح باستخدامهم ثم حاول مرة أخرى.');
        stopCall();
      }
    };

    startCall();

    return () => {
      closed = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      stopCall();
    };
  }, [initiatorId, isCaller, roomId, route?.params?.appointmentId, user?.uid]);

  const endCall = () => {
    localStreamRef.current?.getTracks?.().forEach((track: any) => track.stop());
    pcRef.current?.close?.();
    navigation.goBack();
  };

  const webCall = Platform.OS === 'web'
    ? React.createElement('div', { style: styles.webStage as any }, [
        React.createElement('video', {
          key: 'remote',
          ref: remoteVideoRef,
          autoPlay: true,
          playsInline: true,
          style: styles.remoteVideo as any,
        }),
        React.createElement('video', {
          key: 'local',
          ref: localVideoRef,
          autoPlay: true,
          playsInline: true,
          muted: true,
          style: styles.localVideo as any,
        }),
      ])
    : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-forward" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTextBox}>
          <Text style={styles.title}>مكالمة الفيديو</Text>
          <Text style={styles.subtitle}>{route?.params?.doctorName || route?.params?.participantName || 'جلسة Medicare'}</Text>
        </View>
        <TouchableOpacity style={[styles.headerBtn, styles.endBtn]} onPress={endCall}>
          <Ionicons name="call" size={18} color="#FFF" />
          <Text style={styles.endText}>إنهاء</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.callFrame}>
        {Platform.OS === 'web' ? (
          <>
            {webCall}
            <View style={styles.statusBar}>
              <Text style={styles.statusText}>{error || status}</Text>
            </View>
          </>
        ) : (
          <View style={styles.unsupportedBox}>
            <Ionicons name="videocam-outline" size={42} color={COLORS.primaryLight} />
            <Text style={styles.unsupportedTitle}>مكالمة الفيديو تعمل داخل نسخة الويب</Text>
            <Text style={styles.unsupportedText}>افتح التطبيق من المتصفح للدخول للمكالمة داخل Medicare.</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  header: { height: 84, marginTop: 24, paddingHorizontal: 18, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerBtn: { minWidth: 44, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.borderColor },
  headerTextBox: { flex: 1, alignItems: 'center' },
  title: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold' },
  subtitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  endBtn: { flexDirection: 'row-reverse', gap: 6, backgroundColor: COLORS.danger, borderColor: COLORS.danger, paddingHorizontal: 12 },
  endText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  callFrame: { flex: 1, marginHorizontal: 18, marginBottom: 18, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.borderColor, backgroundColor: '#050505' },
  webStage: { width: '100%', height: '100%', position: 'relative', backgroundColor: '#050505', overflow: 'hidden' },
  remoteVideo: { width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#111' },
  localVideo: { position: 'absolute', left: 18, bottom: 58, width: 220, height: 132, maxWidth: '34%', borderRadius: 14, objectFit: 'cover', backgroundColor: '#111', borderWidth: 2, borderStyle: 'solid', borderColor: COLORS.borderColor },
  statusBar: { position: 'absolute', left: 18, right: 18, bottom: 16, minHeight: 36, borderRadius: 12, backgroundColor: 'rgba(0, 0, 0, 0.58)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  statusText: { color: '#FFF', fontSize: 13, fontWeight: 'bold', textAlign: 'center' },
  unsupportedBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  unsupportedTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold', marginTop: 14, textAlign: 'center' },
  unsupportedText: { color: COLORS.textSecondary, fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 },
});
