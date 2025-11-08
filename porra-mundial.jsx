import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, collection, query, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

// =================================================================
// 1. CONFIGURACIÓN INICIAL DE FIREBASE Y CONSTANTES
// =================================================================

// NOTE: These variables are provided by the execution environment
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-porra-app';
const LOCKOUT_DATE = new Date('2026-06-11T23:59:59').getTime(); // Lockout date for predictions

// Scoring structure
const POINTS = {
    EXACT_SCORE: 5,
    CORRECT_OUTCOME: 2, // Win or Draw
};

// =================================================================
// 2. FIREBASE UTILITIES AND BUSINESS LOGIC
// =================================================================

// Defines base paths for collections
const getPublicCollectionPath = (collectionName) => `/artifacts/${appId}/public/data/${collectionName}`;
const getPrivatePronosticsPath = (userId, matchId) => `/artifacts/${appId}/users/${userId}/pronostics/match_${matchId}`;
const getParticipantDocPath = (userId) => `/artifacts/${appId}/public/data/participants/${userId}`;

/**
 * Calculates points obtained from a prediction.
 * @param {number} actualA - Real goals for team A
 * @param {number} actualB - Real goals for team B
 * @param {number} predA - Predicted goals for team A
 * @param {number} predB - Predicted goals for team B
 * @returns {number} Points won
 */
const calculatePoints = (actualA, actualB, predA, predB) => {
    if (actualA === null || actualB === null) return 0; // Match not played or no result

    // 1. Determine the outcome (Win/Draw/Loss)
    const actualResult = Math.sign(actualA - actualB);
    const predictedResult = Math.sign(predA - predB);

    // 2. Exact score prediction (5 points)
    if (actualA === predA && actualB === predB) {
        return POINTS.EXACT_SCORE;
    }

    // 3. Correct winner or draw prediction (2 points)
    if (actualResult === predictedResult) {
        return POINTS.CORRECT_OUTCOME;
    }

    return 0;
};

// =================================================================
// 3. VIEW COMPONENTS
// =================================================================

// Component to show a floating message (alert() replacement)
const MessageBox = ({ message, onClose }) => (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-white p-6 rounded-lg shadow-2xl text-center max-w-sm">
            <p className="text-gray-800 font-semibold mb-4">{message}</p>
            <button
                onClick={onClose}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition duration-300"
            >
                Entendido
            </button>
        </div>
    </div>
);

// --- VIEW: CLASSIFICATION (index.html) ---
const ClasificacionView = ({ participants, onSelectUser, currentUserId }) => {
    // Sort participants by points (descending)
    const sortedParticipants = useMemo(() => {
        return [...participants].sort((a, b) => b.points - a.points);
    }, [participants]);

    return (
        <div className="p-4 md:p-8">
            <h2 className="text-3xl font-extrabold text-blue-800 mb-6 border-b-4 border-yellow-500 pb-2">🏆 Tabla de Posiciones</h2>
            
            <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-blue-800 text-white">
                        <tr>
                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase tracking-wider">Pos.</th>
                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase tracking-wider">Participante</th>
                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase tracking-wider">Puntos</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {sortedParticipants.map((p, index) => (
                            <tr
                                key={p.id}
                                className={`hover:bg-blue-50 transition duration-150 ${p.id === currentUserId ? 'bg-yellow-100 font-bold' : ''}`}
                            >
                                <td className="py-3 px-4 whitespace-nowrap text-lg text-center">{index + 1}</td>
                                <td 
                                    className="py-3 px-4 whitespace-nowrap text-blue-600 cursor-pointer hover:underline"
                                    onClick={() => onSelectUser(p.id)}
                                >
                                    {p.name} {p.id === currentUserId && '(Tú)'}
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap text-xl font-extrabold text-blue-700">{p.points}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <p className="mt-6 text-center text-sm text-gray-600">
                Tu ID de Participante (Compártelo si es necesario): <span className="font-mono text-xs bg-gray-200 p-1 rounded">{currentUserId || 'Cargando...'}</span>
            </p>
        </div>
    );
};

// --- VIEW: MATCH CALENDAR (partidos.html) ---
const PartidosView = ({ userId, matches, allPronostics, isLocked, db, setShowMessage }) => {
    // Groups matches by date (for a cleaner calendar)
    const groupedMatches = useMemo(() => {
        return matches.reduce((acc, match) => {
            const dateStr = new Date(match.date.seconds * 1000).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
            if (!acc[dateStr]) {
                acc[dateStr] = [];
            }
            acc[dateStr].push(match);
            return acc;
        }, {});
    }, [matches]);

    const handlePronosticSubmit = async (matchId, predA, predB) => {
        if (!userId || !db) return;
        
        // Score validation (must be non-negative integers)
        const a = parseInt(predA);
        const b = parseInt(predB);

        if (isNaN(a) || isNaN(b) || a < 0 || b < 0) {
            setShowMessage('Por favor, introduce un resultado válido (números enteros no negativos).');
            return;
        }

        try {
            const docRef = doc(db, getPrivatePronosticsPath(userId, matchId));
            await setDoc(docRef, { predictionA: a, predictionB: b, matchId: matchId, userId: userId }, { merge: true });
            setShowMessage('✅ ¡Pronóstico guardado con éxito!');
        } catch (error) {
            console.error("Error saving prediction: ", error);
            setShowMessage('❌ Error al guardar el pronóstico. Inténtalo de nuevo.');
        }
    };

    return (
        <div className="p-4 md:p-8">
            <h2 className="text-3xl font-extrabold text-blue-800 mb-6 border-b-4 border-yellow-500 pb-2">📅 Calendario General</h2>
            
            {isLocked && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-lg font-bold">
                    🚫 El plazo para hacer pronósticos (11 de Junio de 2026) ha terminado. ¡Ya no puedes modificar tus resultados!
                </div>
            )}

            {Object.entries(groupedMatches).map(([date, matches]) => (
                <div key={date} className="mb-8">
                    <h3 className="text-xl font-bold text-gray-700 bg-gray-100 p-3 rounded-t-lg sticky top-0 z-10">{date}</h3>
                    {matches.map(match => {
                        // Find the current user's prediction for this match
                        const pronostic = Object.values(allPronostics).find(p => p.matchId === match.id && p.userId === userId) || { predictionA: '', predictionB: '' };
                        const scoreA = match.scoreA !== null ? match.scoreA : '-';
                        const scoreB = match.scoreB !== null ? match.scoreB : '-';
                        const isPlayed = match.scoreA !== null;
                        
                        let points = 0;
                        if (isPlayed && pronostic.predictionA !== '') {
                            points = calculatePoints(match.scoreA, match.scoreB, pronostic.predictionA, pronostic.predictionB);
                        }

                        return (
                            <MatchCard
                                key={match.id}
                                match={match}
                                pronostic={pronostic}
                                scoreA={scoreA}
                                scoreB={scoreB}
                                points={points}
                                isPlayed={isPlayed}
                                isLocked={isLocked}
                                onSubmit={handlePronosticSubmit}
                            />
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

// Match Card Component
const MatchCard = ({ match, pronostic, scoreA, scoreB, points, isPlayed, isLocked, onSubmit }) => {
    const [predA, setPredA] = useState(pronostic.predictionA || '');
    const [predB, setPredB] = useState(pronostic.predictionB || '');

    // Update internal states when Firestore predictions change
    useEffect(() => {
        // Ensure that if the prediction is truly null/empty string, it's reflected here
        setPredA(pronostic.predictionA !== '' && pronostic.predictionA !== null ? pronostic.predictionA : '');
        setPredB(pronostic.predictionB !== '' && pronostic.predictionB !== null ? pronostic.predictionB : '');
    }, [pronostic]);
    
    // Function to handle submission
    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(match.id, predA, predB);
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white border-l-4 border-blue-600 p-4 md:p-6 mb-3 rounded-lg shadow-md flex flex-col md:flex-row justify-between items-center transition duration-300 hover:shadow-lg">
            
            {/* Match Details */}
            <div className="flex-grow w-full md:w-auto md:mr-6 mb-4 md:mb-0">
                <p className="text-xs text-gray-500 font-semibold uppercase">{match.group}</p>
                <p className="text-lg font-bold text-blue-800">
                    {match.teamA} <span className="text-gray-400 font-normal mx-2 text-base">vs</span> {match.teamB}
                </p>
                <p className="text-sm text-gray-600">
                    {new Date(match.date.seconds * 1000).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}h
                </p>
            </div>
            
            {/* Final Score (if played) */}
            <div className={`flex items-center space-x-4 border-r border-gray-200 pr-6 ${!isPlayed ? 'hidden' : ''} md:mr-6`}>
                <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Resultado Real</p>
                    <div className="text-xl font-extrabold text-red-600">
                        {scoreA} - {scoreB}
                    </div>
                </div>
                {points > 0 && (
                    <div className="bg-green-100 text-green-700 py-1 px-3 rounded-full font-bold text-sm">
                        +{points} Ptos
                    </div>
                )}
            </div>

            {/* Prediction Area / Points */}
            <div className="flex items-center space-x-4 mt-4 md:mt-0">
                <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Tu Pronóstico</p>
                    <div className="flex space-x-2">
                        <input
                            type="number"
                            min="0"
                            value={predA}
                            onChange={(e) => setPredA(e.target.value)}
                            className="w-12 text-center border-2 border-gray-300 rounded-lg p-1 font-semibold text-lg"
                            disabled={isLocked || isPlayed}
                        />
                        <span className="text-xl font-bold">-</span>
                        <input
                            type="number"
                            min="0"
                            value={predB}
                            onChange={(e) => setPredB(e.target.value)}
                            className="w-12 text-center border-2 border-gray-300 rounded-lg p-1 font-semibold text-lg"
                            disabled={isLocked || isPlayed}
                        />
                    </div>
                </div>
                
                <button
                    type="submit"
                    className={`
                        py-2 px-4 rounded-lg font-bold transition duration-300 text-sm
                        ${isLocked || isPlayed ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-yellow-500 hover:bg-yellow-600 text-blue-800'}
                    `}
                    disabled={isLocked || isPlayed}
                >
                    {isPlayed ? 'VISTO' : 'GUARDAR'}
                </button>
            </div>
        </form>
    );
};

// --- VIEW: INDIVIDUAL PARTICIPANT PREDICTIONS ---
const UserPronosticsView = ({ userId, userName, matches, allPronostics, onBack }) => {
    
    // Filter predictions for the selected user
    const userPronostics = useMemo(() => {
        return Object.values(allPronostics).filter(p => p.userId === userId);
    }, [userId, allPronostics]);

    // Join predictions with matches to show detail
    const detailedPronostics = useMemo(() => {
        return matches.map(match => {
            const pronostic = userPronostics.find(p => p.matchId === match.id) || { predictionA: '?', predictionB: '?' };
            
            let points = 0;
            if (match.scoreA !== null && pronostic.predictionA !== '?' && pronostic.predictionB !== '?') {
                // Ensure prediction values are numeric before calculating
                const predA = parseInt(pronostic.predictionA);
                const predB = parseInt(pronostic.predictionB);
                
                if (!isNaN(predA) && !isNaN(predB)) {
                    points = calculatePoints(match.scoreA, match.scoreB, predA, predB);
                }
            }
            
            return {
                ...match,
                pronostic,
                points,
                isPlayed: match.scoreA !== null,
            };
        });
    }, [matches, userPronostics]);


    return (
        <div className="p-4 md:p-8">
            <button 
                onClick={onBack}
                className="mb-6 flex items-center text-blue-600 hover:text-blue-800 font-semibold transition duration-200"
            >
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                Volver a la Clasificación
            </button>

            <h2 className="text-3xl font-extrabold text-blue-800 mb-6 border-b-4 border-yellow-500 pb-2">
                Pronósticos de {userName}
            </h2>

            <div className="space-y-4">
                {detailedPronostics.map(item => (
                    <div key={item.id} className={`bg-white p-4 rounded-lg shadow-md flex justify-between items-center ${item.isPlayed ? 'border-l-4 border-green-500' : 'border-l-4 border-gray-300'}`}>
                        <div className="flex-grow">
                            <p className="text-xs text-gray-500">{new Date(item.date.seconds * 1000).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} | {item.group}</p>
                            <p className="text-lg font-semibold">{item.teamA} vs {item.teamB}</p>
                        </div>

                        <div className="text-center mx-4">
                            <p className="text-xs text-gray-500 mb-1">Su Pronóstico</p>
                            <div className="text-xl font-bold text-blue-600">
                                {item.pronostic.predictionA} - {item.pronostic.predictionB}
                            </div>
                        </div>

                        {item.isPlayed ? (
                            <div className="text-center">
                                <p className="text-xs text-gray-500 mb-1">Resultado Real</p>
                                <div className="text-xl font-bold text-red-600">
                                    {item.scoreA} - {item.scoreB}
                                </div>
                                <div className={`mt-1 text-sm font-bold ${item.points > 0 ? 'text-green-700' : 'text-gray-500'}`}>
                                    {item.points} Ptos
                                </div>
                            </div>
                        ) : (
                            <div className="text-center">
                                <span className="text-sm text-gray-400">Pendiente</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// =================================================================
// 4. MAIN APPLICATION COMPONENT
// =================================================================

const App = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [participants, setParticipants] = useState([]);
    const [matches, setMatches] = useState([]);
    const [allPronostics, setAllPronostics] = useState({}); // Map: { matchId_userId: { predictionA, predictionB, userId } }
    const [currentPage, setCurrentPage] = useState('Clasificacion'); // 'Clasificacion', 'Partidos', 'PronosticosUsuario'
    const [selectedUserId, setSelectedUserId] = useState(null); // ID of the user for the personalized view
    const [showMessage, setShowMessage] = useState(null); // Modal message

    const isLocked = useMemo(() => Date.now() > LOCKOUT_DATE, []);

    // 1. Firebase Initialization and Authentication
    useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            const dbInstance = getFirestore(app);
            const authInstance = getAuth(app);
            setDb(dbInstance);
            setAuth(authInstance);

            const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
                if (user) {
                    setUserId(user.uid);
                    // Create or update participant profile
                    const participantRef = doc(dbInstance, getPublicCollectionPath('participants'), user.uid);
                    await setDoc(participantRef, { 
                        name: `Participante ${user.uid.substring(0, 4)}`,
                        points: 0,
                        id: user.uid
                    }, { merge: true });
                } else {
                    // If no user, sign in anonymously or with token
                    try {
                        if (initialAuthToken) {
                            await signInWithCustomToken(authInstance, initialAuthToken);
                        } else {
                            await signInAnonymously(authInstance);
                        }
                    } catch (error) {
                        console.error("Error signing in:", error);
                        // Fallback: use a random ID if authentication fails completely
                        setUserId(crypto.randomUUID()); 
                    }
                }
                setIsAuthReady(true);
            });

            return () => unsubscribe();
        } catch (error) {
            console.error("Error initializing Firebase:", error);
        }
    }, []);

    // 2. Firestore Listeners (Public Data and Matches)
    useEffect(() => {
        if (!db || !isAuthReady) return;

        // Listener 1: Participants (Classification)
        const qParticipants = query(collection(db, getPublicCollectionPath('participants')));
        const unsubParticipants = onSnapshot(qParticipants, (snapshot) => {
            const list = snapshot.docs.map(doc => doc.data());
            setParticipants(list);
        });

        // Listener 2: Matches (Calendar and Results)
        const qMatches = query(collection(db, getPublicCollectionPath('matches')));
        const unsubMatches = onSnapshot(qMatches, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMatches(list);
            
            // If no matches, add examples
            if (list.length === 0) {
                initializeMatches(db);
            }
        });

        return () => {
            unsubParticipants();
            unsubMatches();
        };
    }, [db, isAuthReady]);

    // 3. Listener for ALL Pronostics (needed for global view/recalculation)
    useEffect(() => {
        if (!db || !isAuthReady || participants.length === 0) return;

        const allUnsubs = [];
        
        // This is necessary to listen to all users' pronostics for the personalized view and points calculation
        participants.forEach(p => {
            const pronosticQ = query(collection(db, `/artifacts/${appId}/users/${p.id}/pronostics`));
            const unsub = onSnapshot(pronosticQ, (snapshot) => {
                const userPronosticsMap = {};
                snapshot.forEach(doc => {
                    // Key format: matchId
                    userPronosticsMap[doc.id] = { ...doc.data(), matchId: doc.id, userId: p.id };
                });
                
                // Update the global map of all pronostics
                setAllPronostics(prev => {
                    const newState = { ...prev };
                    
                    // Remove old entries for this user
                    Object.keys(newState).forEach(key => {
                        if (newState[key].userId === p.id) {
                            delete newState[key];
                        }
                    });

                    // Add new/updated entries for this user
                    Object.keys(userPronosticsMap).forEach(matchId => {
                         // Use a unique key for the map of ALL pronostics (matchId_userId)
                        newState[`${matchId}_${p.id}`] = userPronosticsMap[matchId];
                    });
                    
                    return newState;
                });
            });
            allUnsubs.push(unsub);
        });

        return () => {
            allUnsubs.forEach(unsub => unsub());
        };
    }, [db, isAuthReady, participants]);


    // Function to handle SCORING (Simulating results update)
    const handleSimulateResults = async () => {
        if (!db || !matches.length || !participants.length) {
             setShowMessage("Cargando datos. Inténtalo de nuevo en unos segundos.");
             return;
        }

        const batch = writeBatch(db);
        const newMatchResults = [...matches];
        let totalUpdates = 0;

        // 1. Simulate results for unplayed matches
        newMatchResults.forEach(match => {
            if (match.scoreA === null) {
                // Generate a random result
                match.scoreA = Math.floor(Math.random() * 4); 
                match.scoreB = Math.floor(Math.random() * 4);
                
                // Mark the match for update in Firestore
                const matchRef = doc(db, getPublicCollectionPath('matches'), match.id);
                batch.update(matchRef, { scoreA: match.scoreA, scoreB: match.scoreB });
                totalUpdates++;
            }
        });
        
        // 2. Recalculate points for each participant only on completed matches
        const completedMatches = newMatchResults.filter(m => m.scoreA !== null);
        
        participants.forEach(participant => {
            let totalPoints = 0;
            
            completedMatches.forEach(match => {
                // Retrieve the prediction from the global map using the composite key
                const pronosticEntry = allPronostics[`${match.id}_${participant.id}`];
                
                if (pronosticEntry) {
                    const predA = parseInt(pronosticEntry.predictionA);
                    const predB = parseInt(pronosticEntry.predictionB);
                    
                    if (!isNaN(predA) && !isNaN(predB)) {
                        const points = calculatePoints(match.scoreA, match.scoreB, predA, predB);
                        totalPoints += points;
                    }
                }
            });

            // Update participant's points in Firestore
            const participantRef = doc(db, getPublicCollectionPath('participants'), participant.id);
            batch.update(participantRef, { points: totalPoints });
            totalUpdates++;
        });

        if (totalUpdates > 0) {
            await batch.commit();
            setShowMessage(`🎉 ¡Resultados simulados y ${totalUpdates} documentos actualizados!`);
        } else {
            setShowMessage("No hay partidos nuevos para jugar o resultados para actualizar.");
        }
    };
    
    // Function to initialize example matches
    const initializeMatches = async (db) => {
        const initialMatches = [
            { id: 'm1', teamA: 'Alemania', teamB: 'Japón', group: 'Grupo E', date: new Date('2026-06-12T17:00:00') },
            { id: 'm2', teamA: 'España', teamB: 'Canadá', group: 'Grupo F', date: new Date('2026-06-12T20:00:00') },
            { id: 'm3', teamA: 'Argentina', teamB: 'Arabia Saudí', group: 'Grupo C', date: new Date('2026-06-13T10:00:00') },
            { id: 'm4', teamA: 'Brasil', teamB: 'Serbia', group: 'Grupo G', date: new Date('2026-06-13T14:00:00') },
            { id: 'm5', teamA: 'Francia', teamB: 'Australia', group: 'Grupo D', date: new Date('2026-06-14T17:00:00') },
        ].map(m => ({
            ...m,
            scoreA: null, 
            scoreB: null, 
            date: m.date,
        }));

        const batch = writeBatch(db);
        initialMatches.forEach(match => {
            const docRef = doc(db, getPublicCollectionPath('matches'), match.id);
            batch.set(docRef, match);
        });
        await batch.commit();
        console.log("Partidos iniciales añadidos a Firestore.");
    };

    // Function to handle navigation to the personalized view
    const handleSelectUser = (id) => {
        setSelectedUserId(id);
        setCurrentPage('PronosticosUsuario');
    };
    
    // Determine which view to render
    const renderContent = () => {
        if (!isAuthReady) {
            return <div className="text-center p-10 text-xl text-blue-600">Cargando aplicación...</div>;
        }

        const selectedUserPronostics = {};
        // Filter the global map to provide only the relevant predictions to the view
        Object.keys(allPronostics).forEach(key => {
            const pronostic = allPronostics[key];
            if (pronostic.userId === userId) {
                selectedUserPronostics[pronostic.matchId] = pronostic;
            }
        });

        switch (currentPage) {
            case 'Clasificacion':
                return <ClasificacionView 
                    participants={participants} 
                    onSelectUser={handleSelectUser} 
                    currentUserId={userId} 
                />;
            case 'Partidos':
                return <PartidosView 
                    userId={userId}
                    matches={matches} 
                    // Pass only the current user's predictions to PartidosView
                    allPronostics={selectedUserPronostics} 
                    isLocked={isLocked}
                    db={db}
                    setShowMessage={setShowMessage}
                />;
            case 'PronosticosUsuario':
                const user = participants.find(p => p.id === selectedUserId);
                if (!user) return <p className="text-center p-10">Usuario no encontrado.</p>;
                return <UserPronosticsView 
                    userId={selectedUserId}
                    userName={user.name}
                    matches={matches}
                    // Pass the global map to UserPronosticsView for viewing everyone's data
                    allPronostics={allPronostics}
                    onBack={() => setCurrentPage('Clasificacion')}
                />;
            default:
                return <ClasificacionView 
                    participants={participants} 
                    onSelectUser={handleSelectUser} 
                    currentUserId={userId} 
                />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            {showMessage && <MessageBox message={showMessage} onClose={() => setShowMessage(null)} />}

            {/* Header and Navigation */}
            <header className="bg-blue-900 text-white shadow-lg sticky top-0 z-20">
                <div className="max-w-7xl mx-auto p-4 flex flex-col md:flex-row justify-between items-center">
                    <h1 className="text-3xl font-extrabold flex items-center mb-3 md:mb-0">
                        ⚽ Porra Mundial 2026
                    </h1>
                    <nav className="flex space-x-3 text-sm font-semibold">
                        <NavItem title="Clasificación" target="Clasificacion" current={currentPage} onClick={setCurrentPage} />
                        <NavItem title="Partidos" target="Partidos" current={currentPage} onClick={setCurrentPage} />
                    </nav>
                </div>
            </header>

            {/* Simulation Button (for testing) */}
            <div className="max-w-7xl mx-auto w-full px-4 md:px-8 py-3 bg-white shadow-inner flex justify-center">
                <button
                    onClick={handleSimulateResults}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300 text-sm"
                >
                    🚨 Simular Resultados de Partidos NO Jugados 🚨
                </button>
            </div>

            {/* Main Content */}
            <main className="flex-grow max-w-7xl mx-auto w-full">
                {renderContent()}
            </main>

            {/* Footer */}
            <footer className="bg-gray-800 text-white text-center p-4 mt-8">
                <p className="text-sm">Hecho con React y Firestore. ID: {appId}</p>
            </footer>
        </div>
    );
};

const NavItem = ({ title, target, current, onClick }) => (
    <button
        onClick={() => onClick(target)}
        className={`
            py-2 px-4 rounded-lg transition duration-300 
            ${current === target ? 'bg-yellow-500 text-blue-900 font-bold shadow-md' : 'hover:bg-blue-700 text-gray-200'}
        `}
    >
        {title}
    </button>
);

// We add the log level initialization for Firestore debugging
if (typeof setLogLevel !== 'undefined') {
    setLogLevel('Debug');
}

export default App;