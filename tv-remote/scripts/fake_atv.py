# تلفزيون Android TV وهمي: يطبّق جهة التلفزيون من بروتوكول Android TV Remote v2 (باستخدام تعريفات protobuf من مكتبة androidtvremote2)
# يشتغل على TLS حقيقي مع شهادة العميل. يكتب ما يستلمه في atv.log، ورمز الاقتران في pair_code.txt
import datetime, hashlib, os, socket, sys, threading, time
from OpenSSL import SSL, crypto
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from google.protobuf.internal.decoder import _DecodeVarint
from google.protobuf.internal.encoder import _EncodeVarint
from androidtvremote2 import polo_pb2 as polo, remotemessage_pb2 as rm
from androidtvremote2.pairing import _int_to_bytes

LOG = open('atv.log', 'a', buffering=1)
def log(s): LOG.write(s + '\n')

# شهادة التلفزيون
key = rsa.generate_private_key(65537, 2048)
name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'FakeTV')])
cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(x509.random_serial_number())
        .not_valid_before(datetime.datetime(2020, 1, 1)).not_valid_after(datetime.datetime(2040, 1, 1)).sign(key, hashes.SHA256()))
open('tv.pem', 'wb').write(cert.public_bytes(serialization.Encoding.PEM))
open('tv.key', 'wb').write(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()))
srv_numbers = key.public_key().public_numbers()

paired = set()
controls = []

def make_ctx():
    ctx = SSL.Context(SSL.TLS_SERVER_METHOD)
    ctx.use_certificate_file('tv.pem'); ctx.use_privatekey_file('tv.key')
    ctx.set_verify(SSL.VERIFY_PEER, lambda conn, c, e, d, ok: True)   # نقبل أي شهادة عميل (مثل التلفزيون الحقيقي)
    return ctx

def recv_exact(conn, n):
    b = b''
    while len(b) < n:
        c = conn.recv(n - len(b))
        if not c: raise EOFError
        b += c
    return b

def read_frame(conn):
    data = b''
    while True:
        data += recv_exact(conn, 1)
        try:
            n, pos = _DecodeVarint(data, 0); break
        except IndexError:
            continue
    return recv_exact(conn, n)

def send_frame(conn, msg):
    raw = msg.SerializeToString(); out = bytearray(); _EncodeVarint(out.extend, len(raw)); conn.sendall(bytes(out) + raw)

def peer_info(conn):
    c = conn.get_peer_certificate().to_cryptography()
    n = c.public_key().public_numbers()
    return hashlib.sha256(c.public_bytes(serialization.Encoding.DER)).hexdigest(), n

def outer():
    m = polo.OuterMessage(); m.protocol_version = 2; m.status = polo.OuterMessage.Status.STATUS_OK; return m

def pairing_conn(conn):
    fp, cn = peer_info(conn); expect = None
    log('PAIR_CONNECT')
    while True:
        m = polo.OuterMessage(); m.ParseFromString(read_frame(conn))
        r = outer()
        if m.HasField('pairing_request'):
            r.pairing_request_ack.server_name = 'Fake TV'; log(f'PAIR_REQUEST {m.pairing_request.client_name}')
        elif m.HasField('options'):
            r.options.preferred_role = polo.Options.RoleType.ROLE_TYPE_OUTPUT
            e = r.options.output_encodings.add(); e.type = polo.Options.Encoding.ENCODING_TYPE_HEXADECIMAL; e.symbol_length = 6
        elif m.HasField('configuration'):
            r.configuration_ack.SetInParent()
            nonce = os.urandom(2)
            h = hashlib.sha256()
            for x in (cn.n, cn.e, srv_numbers.n, srv_numbers.e): h.update(_int_to_bytes(x))
            h.update(nonce); expect = h.digest()
            open('pair_code.txt', 'w').write(f'{expect[0]:02X}{nonce.hex().upper()}')
            log('PAIR_CODE_SHOWN')
        elif m.HasField('secret'):
            if m.secret.secret == expect:
                paired.add(fp); r.secret_ack.secret = expect; log('PAIRED')
            else:
                r.status = polo.OuterMessage.Status.STATUS_BAD_SECRET; log('PAIR_BAD_SECRET')
        send_frame(conn, r)

def remote_conn(conn):
    fp, _ = peer_info(conn)
    if fp not in paired:
        log('CONTROL_REJECTED_NOT_PAIRED'); conn.close(); return
    lock = threading.Lock(); controls.append((conn, lock))
    def send(msg):
        with lock: send_frame(conn, msg)
    cfg = rm.RemoteMessage(); cfg.remote_configure.code1 = 622; cfg.remote_configure.device_info.model = 'FakeTV'; cfg.remote_configure.device_info.vendor = 'Test'
    send(cfg)
    def pinger():
        i = 0
        while True:
            time.sleep(5); i += 1
            p = rm.RemoteMessage(); p.remote_ping_request.val1 = i
            try: send(p)
            except Exception: return
    threading.Thread(target=pinger, daemon=True).start()
    while True:
        m = rm.RemoteMessage(); m.ParseFromString(read_frame(conn))
        if m.HasField('remote_configure'):
            log(f'CLIENT_CONFIG {m.remote_configure.code1} {m.remote_configure.device_info.package_name}')
            a = rm.RemoteMessage(); a.remote_set_active.active = 622; send(a)
        elif m.HasField('remote_set_active'):
            s = rm.RemoteMessage(); s.remote_start.started = True; send(s); log('CONTROL_CONNECTED')
        elif m.HasField('remote_key_inject'):
            log(f'KEY {m.remote_key_inject.key_code} {m.remote_key_inject.direction}')
        elif m.HasField('remote_app_link_launch_request'):
            log(f'LAUNCH {m.remote_app_link_launch_request.app_link}')
        elif m.HasField('remote_ime_batch_edit'):
            b = m.remote_ime_batch_edit
            log(f'TEXT {b.edit_info[0].text_field_status.value} ime={b.ime_counter} field={b.field_counter}')
        elif m.HasField('remote_ping_response'):
            pass

def serve(port, handler):
    s = socket.socket(); s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1); s.bind(('0.0.0.0', port)); s.listen(5)
    ctx = make_ctx()
    def loop():
        while True:
            c, _ = s.accept()
            def run(c=c):
                try:
                    conn = SSL.Connection(ctx, c); conn.set_accept_state(); conn.do_handshake(); handler(conn)
                except Exception as e:
                    log(f'CONN_END {port} {type(e).__name__}')
            threading.Thread(target=run, daemon=True).start()
    threading.Thread(target=loop, daemon=True).start()

serve(6467, pairing_conn); serve(6466, remote_conn)
log('READY')
# أمر لإظهار لوحة المفاتيح على الجوال (كأن المستخدم ضغط على حقل بحث في التلفزيون)
while True:
    time.sleep(0.5)
    if os.path.exists('show_keyboard'):
        os.remove('show_keyboard')
        for conn, lock in list(controls):
            k = rm.RemoteMessage(); k.remote_ime_show_request.remote_text_field_status.counter_field = 1
            try:
                with lock: send_frame(conn, k)
                log('KEYBOARD_SHOWN')
            except Exception: pass
