// src/App.jsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  ShoppingCart, Utensils, IceCream, Plus, Minus, X, Home,
  ChevronRight, Ban, MapPin, Truck, Clock, Zap, Loader2, Cake,
  Heart, Cookie, Camera, Instagram, Copy
} from "lucide-react";

import { db, auth, collection, addDoc, serverTimestamp, doc, setDoc, onSnapshot } from "./firebase";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";

/* ----------------------
   Constants & Data
   ---------------------- */
const COLLECTION_ORDERS = "doceeser_pedidos";
const COLLECTION_CARTS = "carts";
const DELIVERY_FEE = 2.99;
const ACAI_ID = 18;
const ACAI_BASE_PRICE = 17.9;

const ACAI_TOPPINGS = [
  { name: "Banana", price: 0.01 },
  { name: "Morango", price: 2.0 },
  { name: "Leite Ninho", price: 1.0 },
  { name: "Leite Condensado", price: 0.01 },
  { name: "Creme de Ninho", price: 1.0 },
  { name: "Nutella", price: 3.0 },
  { name: "Amendoim", price: 1.0 },
];

const initialProducts = [
  // reduced sample (keep same IDs you use)
  { id: 9, name: "Red velvet com Ninho e Morangos", price: 15.90, category: 'bolos', description: "Massa aveludada...", imageUrl: "https://i.imgur.com/3UDWhLR.png" },
  { id: 2, name: "Bolo Cenoura com chocolate", price: 15.90, category: 'bolos', description: "Mini vulcão de cenoura...", imageUrl: "https://i.imgur.com/aaUdL2b.png" },
  { id: 17, name: "Copo Oreo com Nutella", price: 24.90, category: 'copo_felicidade', description: "Primeira camada...", imageUrl: "https://i.imgur.com/1EZRMVl.png" },
  { id: ACAI_ID, name: "Copo de Açaí 250ml", price: ACAI_BASE_PRICE, category: 'acai', description: "Copo de Açaí cremoso...", imageUrl: "https://i.imgur.com/OrErP8N.png" },
  { id: 20, name: "Brownie De Ninho e Nutella", price: 11.90, category: 'brownie', description: "Brownie gourmet...", imageUrl: "https://i.imgur.com/vWdYZ8K.png" },
  { id: 6, name: "Empada de Camarão e Requeijão", price: 12.00, category: 'salgado', description: "Camarão Cremoso...", imageUrl: "https://i.imgur.com/rV18DkJ.png" },
];

const categories = {
  all: 'Todos os Produtos',
  bolos: 'Bolos',
  copo_felicidade: 'Copo da Felicidade',
  brownie: 'Brownies',
  acai: 'Açaí',
  salgado: 'Salgados',
};

const PAYMENT_METHODS = [{ id: 'pix', name: 'Pix', icon: Zap, details: 'Pagamento via QR Code ou chave Pix.' }];

/* ----------------------
   Helper functions
   ---------------------- */

const formatBR = (value) => `R$ ${value.toFixed(2).replace('.', ',')}`;

/* getCartDocRef: doc(db, 'carts', userId) */
const getCartDocRef = (userId) => {
  if (!db || !userId) return null;
  return doc(db, COLLECTION_CARTS, userId);
};

/* createOrder: saves into COLLECTION_ORDERS and returns id */
const createOrder = async ({ cart, total, customer, deliveryType }) => {
  try {
    if (!db) throw new Error("Firestore não inicializado.");
    const pedidosRef = collection(db, COLLECTION_ORDERS);
    const payload = {
      items: cart,
      total,
      customer: customer || {},
      deliveryType: deliveryType || 'delivery',
      status: 'novo',
      createdAt: serverTimestamp()
    };
    const added = await addDoc(pedidosRef, payload);
    return added.id;
  } catch (err) {
    console.error("Erro ao criar pedido:", err);
    return null;
  }
};

/* saveCartToFirestore */
const saveCartToFirestore = async (userId, cart) => {
  try {
    const cartRef = getCartDocRef(userId);
    if (!cartRef) return;
    await setDoc(cartRef, { items: cart, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.error("Erro ao salvar carrinho:", err);
  }
};

/* readCartFromFirestore (onSnapshot uses this) handled in effect below */

/* ----------------------
   Small UI components
   ---------------------- */

const Check = ({ className }) => (
  <svg className={className} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
    <path d="M5 13l4 4L19 7" />
  </svg>
);

/* Product Card */
const ProductCard = ({ product, onAdd, onCustomize }) => {
  const isAcai = product.id === ACAI_ID;
  return (
    <div className="flex flex-col rounded-xl shadow-lg overflow-hidden bg-white">
      <div className="h-40 overflow-hidden relative">
        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" onError={(e)=>e.target.src="https://placehold.co/400x250/cccccc/333333?text=Doce+É+Ser"} />
        <div className="absolute top-0 right-0 p-2 rounded-bl-lg bg-amber-600 text-white text-xs font-bold">{product.category}</div>
      </div>
      <div className="p-4 flex-grow flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-bold">{product.name}</h3>
          <p className="text-sm text-gray-600">{product.description}</p>
        </div>
        <div className="mt-4 flex justify-between items-center">
          <span className="font-extrabold text-amber-700">{formatBR(product.price)}</span>
          <button onClick={() => (isAcai ? onCustomize(product) : onAdd(product))} className="bg-amber-600 text-white p-2 rounded-full">
            {isAcai ? "Customizar" : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* OrderSummary */
const OrderSummary = ({ cart, deliveryType = 'delivery' }) => {
  const subtotal = cart.reduce((s, i) => s + (i.price * (i.quantity || 1)), 0);
  const deliveryFee = deliveryType === 'delivery' ? DELIVERY_FEE : 0;
  const total = subtotal + deliveryFee;
  if (!cart || cart.length === 0) return null;
  return (
    <div className="bg-white p-4 rounded-xl shadow-lg">
      <h4 className="font-bold text-lg">Resumo do Pedido</h4>
      <div className="mt-3 text-sm text-gray-600">
        <div className="flex justify-between"><span>Subtotal</span><span>{formatBR(subtotal)}</span></div>
        <div className="flex justify-between"><span>Entrega</span><span>{deliveryType === 'delivery' ? formatBR(deliveryFee) : 'GRÁTIS'}</span></div>
        <hr className="my-2" />
        <div className="flex justify-between font-bold"><span>Total</span><span>{formatBR(total)}</span></div>
      </div>
      <div className="mt-3 text-xs text-gray-500">
        Itens:
        <ul className="mt-1 list-disc ml-5">
          {cart.map((it, i) => <li key={it.uniqueId || `${it.id}-${i}`}>{(it.quantity||1)}x {it.name} {it.toppings ? `(${it.toppings.join(', ')})` : ''}</li>)}
        </ul>
      </div>
    </div>
  );
};

/* PixPaymentDetails component (isolated) */
const PixPaymentDetails = ({ total, customerInfo, updateCustomer, cart, onConfirm }) => {
  const [copyStatus, setCopyStatus] = useState('Copiar Chave');
  const [copyCodeStatus, setCopyCodeStatus] = useState('Copiar Código');
  const REAL_PIX_KEY = '61.982.423/0001-49';
  const REAL_PIX_KEY_RAW = '61982423000149';
  const recipientName = 'Doce É Ser Tapera';

  const copiaCola = `PIX:${REAL_PIX_KEY_RAW}|${recipientName}|R$${total.toFixed(2).replace('.',',')}`;

  const handleCopyKey = () => {
    navigator.clipboard.writeText(REAL_PIX_KEY).then(()=> { setCopyStatus('Copiado!'); setTimeout(()=>setCopyStatus('Copiar Chave'), 2000); }).catch(()=>setCopyStatus('Erro'));
  };
  const handleCopyCode = () => {
    navigator.clipboard.writeText(copiaCola).then(()=> { setCopyCodeStatus('Copiado!'); setTimeout(()=>setCopyCodeStatus('Copiar Código'), 2000); }).catch(()=>setCopyCodeStatus('Erro'));
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-lg">
      <div className="text-center font-bold text-green-700 mb-3">Pagamento via PIX</div>
      <div className="flex justify-center mb-3">
        <img src="/pix_cnpj_qr.png" alt="QR Pix" className="w-48 h-48 object-contain"/>
      </div>
      <div className="p-3 bg-gray-50 rounded mb-3">
        <div className="text-sm">Beneficiário: {recipientName}</div>
        <div className="text-sm">Chave (CNPJ): {REAL_PIX_KEY}</div>
        <div className="text-xl font-bold mt-2">Valor: {formatBR(total)}</div>
      </div>

      <div className="grid grid-cols-1 gap-2 mb-3">
        <input placeholder="Nome completo" value={customerInfo.nome || ""} onChange={(e)=>updateCustomer('nome', e.target.value)} className="p-2 border rounded"/>
        <input placeholder="Telefone" value={customerInfo.telefone || ""} onChange={(e)=>updateCustomer('telefone', e.target.value)} className="p-2 border rounded"/>
        <input placeholder="Rua" value={customerInfo.rua || ""} onChange={(e)=>updateCustomer('rua', e.target.value)} className="p-2 border rounded"/>
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Número" value={customerInfo.numero || ""} onChange={(e)=>updateCustomer('numero', e.target.value)} className="p-2 border rounded"/>
          <input placeholder="Bairro" value={customerInfo.bairro || ""} onChange={(e)=>updateCustomer('bairro', e.target.value)} className="p-2 border rounded"/>
        </div>
      </div>

      <div className="flex gap-2 justify-center mb-3">
        <button onClick={handleCopyKey} className="px-4 py-2 rounded bg-amber-700 text-white">{copyStatus}</button>
        <button onClick={handleCopyCode} className="px-4 py-2 rounded bg-amber-700 text-white">{copyCodeStatus}</button>
      </div>

      <div className="flex gap-2">
        <button onClick={onConfirm} className="w-full px-4 py-2 rounded bg-green-600 text-white">Enviei o pagamento</button>
      </div>
      <p className="text-xs text-gray-500 mt-2">Após confirmar, envie o comprovante no WhatsApp ou abra o histórico de pedidos.</p>
    </div>
  );
};

/* ----------------------
   Main App
   ---------------------- */
const App = () => {
  const [page, setPage] = useState('menu');
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart] = useState([]);
  const [deliveryType, setDeliveryType] = useState('delivery');
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userId, setUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isAcaiModalOpen, setIsAcaiModalOpen] = useState(false);
  const [acaiProduct, setAcaiProduct] = useState(null);

  const [customerInfo, setCustomerInfo] = useState({
    nome: '', telefone: '', rua: '', numero: '', bairro: '', referencia: ''
  });

  const cartItemCount = useMemo(() => cart.reduce((s, i) => s + (i.quantity || 1), 0), [cart]);

  /* ----------------------
     Auth & cart persistence
     ---------------------- */
  useEffect(() => {
    // Sign in anonymously then subscribe to auth changes
    let unsubAuth = () => {};
    try {
      unsubAuth = onAuthStateChanged(auth, (user) => {
        if (user) {
          setUserId(user.uid);
          setIsAuthReady(true);
        } else {
          // try anonymous sign in
          signInAnonymously(auth).catch((err) => console.warn("Erro signInAnonymously:", err));
        }
      });
    } catch (err) {
      console.warn("Firebase auth not available:", err);
      setIsAuthReady(true);
    }
    return () => unsubAuth();
  }, []);

  // subscribe to cart doc in Firestore (real-time)
  useEffect(() => {
    if (!isAuthReady || !userId) {
      setIsLoading(false);
      return;
    }
    const cartRef = getCartDocRef(userId);
    if (!cartRef) {
      setIsLoading(false);
      return;
    }
    const unsub = onSnapshot(cartRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data() && Array.isArray(docSnap.data().items)) {
        setCart(docSnap.data().items);
      } else {
        setCart([]);
      }
      setIsLoading(false);
    }, (err) => {
      console.error("onSnapshot cart error:", err);
      setIsLoading(false);
    });
    return () => unsub();
  }, [isAuthReady, userId]);

  // save cart to Firestore (debounced simple)
  useEffect(() => {
    if (!isAuthReady || !userId) return;
    const t = setTimeout(() => saveCartToFirestore(userId, cart), 400);
    return () => clearTimeout(t);
  }, [cart, isAuthReady, userId]);

  /* ----------------------
     Cart operations
     ---------------------- */
  const addToCart = useCallback((product) => {
    setCart((prev) => {
      // If non-custom: group by id
      const existing = prev.find(p => p.id === product.id && !p.isCustom);
      if (existing) {
        return prev.map(p => p.id === product.id && !p.isCustom ? { ...p, quantity: (p.quantity || 1) + 1 } : p);
      }
      return [...prev, { ...product, quantity: 1, isCustom: false }];
    });
  }, []);

  const openAcaiModal = (product) => { setAcaiProduct(product); setIsAcaiModalOpen(true); };
  const closeAcaiModal = () => { setAcaiProduct(null); setIsAcaiModalOpen(false); };

  const addCustomAcai = (customItem) => {
    setCart(prev => [...prev, customItem]);
    closeAcaiModal();
  };

  const updateQuantity = (itemKey, delta) => {
    setCart(prev => prev.flatMap(it => {
      const key = it.uniqueId || it.id;
      if (key !== itemKey) return it;
      const newQty = (it.quantity || 1) + delta;
      if (newQty <= 0) return [];
      return { ...it, quantity: newQty };
    }));
  };

  const removeItem = (itemKey) => {
    setCart(prev => prev.filter(it => (it.uniqueId || it.id) !== itemKey));
  };

  /* ----------------------
     Checkout & Order creation
     ---------------------- */
  const subtotal = useMemo(() => cart.reduce((s, i) => s + (i.price * (i.quantity || 1)), 0), [cart]);
  const deliveryFee = deliveryType === 'delivery' ? DELIVERY_FEE : 0;
  const total = subtotal + deliveryFee;

  const handleCreateOrder = async () => {
    // basic validations
    if (cart.length === 0) { alert("Carrinho vazio."); return null; }
    if (!customerInfo.nome || !customerInfo.telefone || !customerInfo.rua || !customerInfo.numero || !customerInfo.bairro) {
      alert("Preencha nome, telefone, rua, número e bairro antes de confirmar.");
      return null;
    }

    const id = await createOrder({ cart, total, customer: customerInfo, deliveryType });
    if (id) {
      // limpar carrinho local e no Firestore
      setCart([]);
      if (userId) await saveCartToFirestore(userId, []);
      alert(`Pedido recebido! ID: ${id}`);
      setPage('menu');
    } else {
      alert("Erro ao criar pedido. Tente novamente.");
    }
    return id;
  };

  /* ----------------------
     UI Pages
     ---------------------- */

  const MenuPage = (
    <div className="p-4 md:p-8">
      <h2 className="text-3xl font-extrabold mb-6">{categories[activeCategory]}</h2>
      <div className="flex gap-3 mb-6 flex-wrap">
        {Object.keys(categories).map(k => (
          <button key={k} onClick={()=>setActiveCategory(k)} className={`px-4 py-2 rounded ${k===activeCategory ? 'bg-amber-700 text-white' : 'bg-gray-100'}`}>
            {categories[k].split(' ')[0]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {initialProducts.filter(p => activeCategory==='all' ? true : p.category === activeCategory).map(p => (
          <ProductCard key={p.id} product={p} onAdd={addToCart} onCustomize={openAcaiModal} />
        ))}
      </div>
    </div>
  );

  const CartPage = (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <h3 className="text-2xl font-bold mb-4">Seu Carrinho</h3>
      {cart.length === 0 ? (
        <div className="text-center p-10 bg-white rounded shadow">
          <ShoppingCart className="mx-auto w-12 h-12 text-gray-300" />
          <p className="mt-3">Seu carrinho está vazio.</p>
          <button onClick={()=>setPage('menu')} className="mt-4 text-amber-700">Voltar ao Menu</button>
        </div>
      ) : (
        <div className="lg:flex lg:space-x-6">
          <div className="flex-grow space-y-4">
            {cart.map((it, idx) => {
              const key = it.uniqueId || it.id || idx;
              return (
                <div key={key} className="flex items-center bg-white p-4 rounded shadow">
                  <div className="flex-grow">
                    <div className="font-semibold">{it.name}</div>
                    <div className="text-sm text-gray-500">{formatBR(it.price)} / un</div>
                    {it.isCustom && it.toppings && <div className="text-xs text-gray-600">+ {it.toppings.join(', ')}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={()=>updateQuantity(key, -1)} className="p-1 border rounded"><Minus className="w-4 h-4" /></button>
                    <div className="font-bold">{it.quantity || 1}</div>
                    <button onClick={()=>updateQuantity(key, 1)} className="p-1 border rounded"><Plus className="w-4 h-4" /></button>
                  </div>
                  <div className="ml-4 font-bold text-amber-700">{formatBR((it.price || 0) * (it.quantity || 1))}</div>
                  <button onClick={()=>removeItem(key)} className="ml-4 text-red-500"><X /></button>
                </div>
              );
            })}
            <div>
              <button onClick={()=>setPage('menu')} className="mt-4 text-amber-700">Continuar comprando</button>
            </div>
          </div>

          <div className="lg:w-80 mt-6 lg:mt-0">
            <OrderSummary cart={cart} deliveryType={deliveryType} />
            <button onClick={()=>setPage('delivery')} className="w-full mt-4 bg-amber-700 text-white py-2 rounded">Prosseguir para Entrega</button>
          </div>
        </div>
      )}
    </div>
  );

  const DeliveryPage = (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <h3 className="text-2xl font-bold mb-4">Entrega</h3>
      <div className="grid md:grid-cols-2 gap-4">
        <label className={`p-4 rounded border ${deliveryType==='delivery' ? 'border-amber-600 bg-amber-50' : 'bg-white'}`}>
          <input type="radio" checked={deliveryType==='delivery'} onChange={()=>setDeliveryType('delivery')} className="hidden" />
          <div className="font-semibold">Entrega (R$ {DELIVERY_FEE.toFixed(2)})</div>
          <div className="text-sm text-gray-600 mt-2">
            <input placeholder="CEP" className="w-full p-2 border rounded mb-2" />
            <input placeholder="Rua, Número, Bairro" onChange={(e)=>setCustomerInfo({...customerInfo, rua: e.target.value})} className="w-full p-2 border rounded" />
          </div>
        </label>

        <label className={`p-4 rounded border ${deliveryType==='retirada' ? 'border-amber-600 bg-amber-50' : 'bg-white'}`}>
          <input type="radio" checked={deliveryType==='retirada'} onChange={()=>setDeliveryType('retirada')} className="hidden" />
          <div className="font-semibold">Retirada na loja (GRÁTIS)</div>
          <div className="text-sm text-gray-600 mt-2">
            <input placeholder="Nome para retirada" className="w-full p-2 border rounded mb-2" onChange={(e)=>setCustomerInfo({...customerInfo, nome: e.target.value})} />
            <input placeholder="Telefone" className="w-full p-2 border rounded" onChange={(e)=>setCustomerInfo({...customerInfo, telefone: e.target.value})} />
          </div>
        </label>
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={()=>setPage('payment')} className="bg-amber-700 text-white px-4 py-2 rounded">Prosseguir para Pagamento</button>
        <button onClick={()=>setPage('cart')} className="bg-gray-200 px-4 py-2 rounded">Voltar</button>
      </div>
    </div>
  );

  const PaymentPage = (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <h3 className="text-2xl font-bold mb-4">Pagamento</h3>
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="space-y-3">
            {PAYMENT_METHODS.map(m => {
              const Icon = m.icon;
              return (
                <label key={m.id} className={`block p-4 rounded border ${paymentMethod===m.id ? 'border-amber-600 bg-amber-50' : 'bg-white'}`}>
                  <input type="radio" checked={paymentMethod===m.id} onChange={()=>setPaymentMethod(m.id)} className="hidden"/>
                  <div className="flex items-center gap-3">
                    <Icon />
                    <div>
                      <div className="font-bold">{m.name}</div>
                      <div className="text-sm text-gray-600">{m.details}</div>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {paymentMethod === 'pix' && (
            <div className="mt-4">
              <PixPaymentDetails total={total} customerInfo={customerInfo} updateCustomer={(f,v)=>setCustomerInfo(prev=>({...prev,[f]:v}))} cart={cart} onConfirm={handleCreateOrder} />
            </div>
          )}

          <div className="mt-4">
            <button disabled={!paymentMethod} onClick={() => {
              // For simulation or other methods: directly create order
              if (paymentMethod !== 'pix') {
                handleCreateOrder();
              }
            }} className={`w-full py-2 rounded font-bold ${paymentMethod ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'}`}>
              {paymentMethod ? 'Confirmar e finalizar' : 'Selecione forma de pagamento'}
            </button>
            <button onClick={()=>setPage('delivery')} className="w-full mt-2 bg-gray-200 py-2 rounded">Voltar</button>
          </div>
        </div>

        <div>
          <OrderSummary cart={cart} deliveryType={deliveryType} />
        </div>
      </div>
    </div>
  );

  const AboutPage = (
    <div className="p-8 max-w-4xl mx-auto text-center">
      <h2 className="text-3xl font-bold text-amber-700">Doce É Ser</h2>
      <p className="mt-4 text-gray-600">Somos uma confeitaria... (edite como quiser)</p>
      <button onClick={()=>setPage('menu')} className="mt-6 bg-amber-700 text-white px-4 py-2 rounded">Ver cardápio</button>
    </div>
  );

  /* ----------------------
     Render
     ---------------------- */
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-16 h-16 animate-spin text-amber-500"/>
        <div className="ml-4 text-lg">A carregar...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 bg-white shadow p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={()=>setPage('menu')}>
            <Cake className="w-6 h-6 text-amber-500" />
            <h1 className="font-bold">Doce É Ser</h1>
          </div>
          <nav className="hidden md:flex gap-4">
            <button onClick={()=>setPage('menu')} className={`px-3 py-1 rounded ${page==='menu' ? 'bg-amber-100 text-amber-700' : ''}`}>Menu</button>
            <button onClick={()=>setPage('about')} className={`px-3 py-1 rounded ${page==='about' ? 'bg-amber-100 text-amber-700' : ''}`}>Sobre</button>
          </nav>
          <div className="flex items-center gap-3">
            <button onClick={()=>setPage('cart')} className="relative bg-amber-700 text-white p-3 rounded-full">
              <ShoppingCart className="w-5 h-5"/>
              {cartItemCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 text-xs rounded-full bg-red-600 flex items-center justify-center border-2 border-white">{cartItemCount}</span>}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto pb-12">
        {page === 'menu' && MenuPage}
        {page === 'cart' && CartPage}
        {page === 'delivery' && DeliveryPage}
        {page === 'payment' && PaymentPage}
        {page === 'about' && AboutPage}
      </main>

      {isAcaiModalOpen && acaiProduct && (
        <AcaiModal
          product={acaiProduct}
          onClose={closeAcaiModal}
          onAdd={(selectedToppings) => {
            const priceExtra = selectedToppings.reduce((s, tName) => {
              const t = ACAI_TOPPINGS.find(x => x.name === tName);
              return s + (t ? t.price : 0);
            }, 0);
            const item = {
              id: acaiProduct.id,
              uniqueId: `acai-${Date.now()}`,
              name: acaiProduct.name,
              toppings: selectedToppings,
              price: (ACAI_BASE_PRICE + priceExtra),
              quantity: 1,
              isCustom: true
            };
            addCustomAcai(item);
          }}
        />
      )}

      <footer className="bg-gray-800 text-white p-4 text-center">
        <div>Desenvolvido por @DivulgaJà</div>
        {userId && <div className="text-xs text-gray-300 mt-1">Sessão: {userId}</div>}
      </footer>
    </div>
  );
};

/* ----------------------
   Acai Modal (small standalone component)
   ---------------------- */
const AcaiModal = ({ product, onClose, onAdd }) => {
  const [selected, setSelected] = useState([]);
  const toggle = (name) => setSelected(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);
  const total = ACAI_BASE_PRICE + selected.reduce((s, n) => s + (ACAI_TOPPINGS.find(t=>t.name===n)?.price || 0), 0);
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg p-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold">{product.name}</h3>
          <button onClick={onClose}><X /></button>
        </div>
        <p className="text-sm text-gray-600 mt-2">Selecione adicionais:</p>
        <div className="mt-4 space-y-2">
          {ACAI_TOPPINGS.map(t => {
            const active = selected.includes(t.name);
            return (
              <div key={t.name} onClick={()=>toggle(t.name)} className={`p-3 rounded border cursor-pointer ${active ? 'bg-amber-50 border-amber-300' : 'bg-white'}`}>
                <div className="flex justify-between items-center">
                  <div>{t.name}</div>
                  <div className="text-sm text-gray-600">{formatBR(t.price)}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex justify-between items-center">
          <div className="font-bold">Total: {formatBR(total)}</div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded border">Cancelar</button>
            <button onClick={()=>onAdd(selected)} className="px-4 py-2 rounded bg-amber-700 text-white">Adicionar</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
