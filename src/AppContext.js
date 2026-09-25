import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { getCustomerRentals, getEquipment } from './database';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const db = useSQLiteContext();
  const [equipment, setEquipment] = useState([]);
  const [rentals, setRentals] = useState([]);
  const [cart, setCart] = useState([]);
  const [bookingDraft, setBookingDraft] = useState(null);

  const refreshEquipment = useCallback(async () => {
    setEquipment(await getEquipment(db));
  }, [db]);

  const refreshRentals = useCallback(async () => {
    setRentals(await getCustomerRentals(db));
  }, [db]);

  useEffect(() => {
    let active = true;
    Promise.all([getEquipment(db), getCustomerRentals(db)]).then(([nextEquipment, nextRentals]) => {
      if (!active) return;
      setEquipment(nextEquipment);
      setRentals(nextRentals);
    });
    return () => { active = false; };
  }, [db]);

  const addToCart = useCallback((item, quantity = 1) => {
    setCart((current) => {
      const existing = current.find((row) => row.equipment_id === item.equipment_id);
      if (existing) {
        return current.map((row) =>
          row.equipment_id === item.equipment_id
            ? { ...row, quantity: Math.min(row.quantity + quantity, item.total_quantity) }
            : row
        );
      }
      return [...current, { ...item, quantity }];
    });
  }, []);

  const updateCartQuantity = useCallback((equipmentId, quantity) => {
    setCart((current) =>
      current.map((item) =>
        item.equipment_id === equipmentId
          ? { ...item, quantity: Math.max(1, Math.min(quantity, item.total_quantity)) }
          : item
      )
    );
  }, []);

  const removeFromCart = useCallback((equipmentId) => {
    setCart((current) => current.filter((item) => item.equipment_id !== equipmentId));
  }, []);

  const value = useMemo(
    () => ({
      db,
      equipment,
      rentals,
      cart,
      bookingDraft,
      setBookingDraft,
      refreshEquipment,
      refreshRentals,
      addToCart,
      updateCartQuantity,
      removeFromCart,
      clearCart: () => setCart([]),
    }),
    [
      db,
      equipment,
      rentals,
      cart,
      bookingDraft,
      refreshEquipment,
      refreshRentals,
      addToCart,
      updateCartQuantity,
      removeFromCart,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
