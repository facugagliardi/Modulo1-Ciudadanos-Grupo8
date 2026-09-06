import os
import json
import shutil

BASE_URL = "http://localhost:8080"
COLLECTION_NAME = "Ciudadanos-Modulo1"
OUTPUT_DIR = "bruno-collection"

# Ensure clean directory
if os.path.exists(OUTPUT_DIR):
    shutil.rmtree(OUTPUT_DIR)
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(os.path.join(OUTPUT_DIR, "environments"), exist_ok=True)

# Generate bruno.json
bruno_json = {
  "version": "1",
  "name": COLLECTION_NAME,
  "type": "collection",
  "ignore": ["node_modules", ".git"]
}
with open(os.path.join(OUTPUT_DIR, "bruno.json"), "w") as f:
    json.dump(bruno_json, f, indent=2)

# Generate environment with specific JWTs
env_bru = """vars {
  baseUrl: http://localhost:8080
  jwt_empleado: 
  jwt_ciudadano: 
}
"""
with open(os.path.join(OUTPUT_DIR, "environments", "local.bru"), "w") as f:
    f.write(env_bru)

def write_bru_file(folder, filename, method, path, body=None, auth_type="none", post_script=None, status_check=200):
    folder_path = os.path.join(OUTPUT_DIR, folder)
    os.makedirs(folder_path, exist_ok=True)
    
    file_path = os.path.join(folder_path, f"{filename}.bru")
    
    content = f"""meta {{
  name: {filename}
  type: http
  seq: 1
}}

{method.lower()} {{
  url: {{{{baseUrl}}}}{path}
  body: {'json' if body else 'none'}
  auth: {auth_type if auth_type == "none" else "bearer"}
}}

"""
    if auth_type == "bearer_empleado":
        content += """auth:bearer {
  token: {{jwt_empleado}}
}

"""
    elif auth_type == "bearer_ciudadano":
        content += """auth:bearer {
  token: {{jwt_ciudadano}}
}

"""
    
    if body:
        content += "body:json {\n"
        if isinstance(body, dict):
            content += "  " + json.dumps(body, indent=2).replace('\n', '\n  ')
        else:
            content += "  " + body
        content += "\n}\n\n"
        
    if post_script:
        content += f"""script:post-response {{
{post_script}
}}

"""
        
    content += f"""tests {{
  test("Status code is {status_check}", function() {{
    expect(res.getStatus()).to.equal({status_check});
  }});
}}
"""

    with open(file_path, "w") as f:
        f.write(content)

endpoints = [
    # ==================== AUTH ====================
    {
        "folder": "01_Auth", "name": "01_Register_Ciudadano_Success",
        "method": "POST", "path": "/auth/register",
        "body": {"tipo": "CIUDADANO", "cuit": "20-12345678-9", "password": "clave-segura-1", "dni": "12345678", "nombre": "Nuevo", "apellido": "Usuario", "fechaNacimiento": "1990-01-01"},
        "auth": "none", "status": 201
    },
    {
        "folder": "01_Auth", "name": "02_Register_Ciudadano_Conflict_409",
        "method": "POST", "path": "/auth/register",
        "body": {"tipo": "CIUDADANO", "cuit": "20-12345678-9", "password": "clave-segura-1", "dni": "12345678", "nombre": "Nuevo", "apellido": "Usuario", "fechaNacimiento": "1990-01-01"},
        "auth": "none", "status": 409
    },
    {
        "folder": "01_Auth", "name": "03_Register_Invalid_400",
        "method": "POST", "path": "/auth/register",
        "body": {"tipo": "INVALID", "cuit": "123", "password": "123"},
        "auth": "none", "status": 400
    },
    {
        "folder": "01_Auth", "name": "04_Login_Empleado_Admin_Success",
        "method": "POST", "path": "/auth/empleados/login",
        "body": {"mail": "admin@municipio.gob.ar", "password": "Empleado.2026"},
        "auth": "none", "status": 200,
        "post_script": "  const headers = res.getHeaders();\n  if (headers['authorization']) {\n    bru.setEnvVar('jwt_empleado', headers['authorization'].replace('Bearer ', ''));\n  }"
    },
    {
        "folder": "01_Auth", "name": "05_Login_Ciudadano_Success",
        "method": "POST", "path": "/auth/login",
        "body": {"cuit": "20345678901", "password": "Ciudadano.2026"},
        "auth": "none", "status": 200,
        "post_script": "  const headers = res.getHeaders();\n  if (headers['authorization']) {\n    bru.setEnvVar('jwt_ciudadano', headers['authorization'].replace('Bearer ', ''));\n  }"
    },
    {
        "folder": "01_Auth", "name": "06_Login_Invalid_401",
        "method": "POST", "path": "/auth/login",
        "body": {"cuit": "20345678901", "password": "WrongPassword"},
        "auth": "none", "status": 401
    },

    # ==================== CIUDADANOS ====================
    {
        "folder": "02_Ciudadanos", "name": "01_Get_Padron_Empleado_Success",
        "method": "GET", "path": "/ciudadanos", "auth": "bearer_empleado", "status": 200
    },
    {
        "folder": "02_Ciudadanos", "name": "02_Get_Padron_Ciudadano_Forbidden_403",
        "method": "GET", "path": "/ciudadanos", "auth": "bearer_ciudadano", "status": 403
    },
    {
        "folder": "02_Ciudadanos", "name": "03_Get_Ciudadano_Propio_Success",
        "method": "GET", "path": "/ciudadanos/1", "auth": "bearer_ciudadano", "status": 200
    },
    {
        "folder": "02_Ciudadanos", "name": "04_Get_Ciudadano_Not_Found_404",
        "method": "GET", "path": "/ciudadanos/9999", "auth": "bearer_empleado", "status": 404
    },
    {
        "folder": "02_Ciudadanos", "name": "05_Put_Ciudadano_Ciudadano_Success",
        "method": "PUT", "path": "/ciudadanos/1",
        "body": {"nombre": "Nombre Editado", "apellido": "Apellido", "fechaNacimiento": "1990-01-01"},
        "auth": "bearer_ciudadano", "status": 200
    },
    {
        "folder": "02_Ciudadanos", "name": "05_Put_Ciudadano_Empleado_Success",
        "method": "PUT", "path": "/ciudadanos/1",
        "body": {"nombre": "Nombre Editado Empleado", "apellido": "Apellido", "fechaNacimiento": "1990-01-01"},
        "auth": "bearer_empleado", "status": 200
    },
    {
        "folder": "02_Ciudadanos", "name": "06_Patch_Estado_Empleado_Success",
        "method": "PATCH", "path": "/ciudadanos/1/estado",
        "body": {"estado": "INACTIVO"},
        "auth": "bearer_empleado", "status": 200
    },
    {
        "folder": "02_Ciudadanos", "name": "07_Patch_Estado_Ciudadano_Forbidden_403",
        "method": "PATCH", "path": "/ciudadanos/1/estado",
        "body": {"estado": "ACTIVO"},
        "auth": "bearer_ciudadano", "status": 403
    },
    {
        "folder": "02_Ciudadanos", "name": "08_Get_DNI_Success",
        "method": "GET", "path": "/ciudadanos/dni/34567890", "auth": "bearer_empleado", "status": 200
    },

    # ==================== ORGANIZACIONES ====================
    {
        "folder": "03_Organizaciones", "name": "01_Post_Organizacion_Ciudadano_Success",
        "method": "POST", "path": "/organizaciones",
        "body": {"cuit": "30-11111111-9", "razonSocial": "Empresa Test", "nombreFantasia": "Empresa Test", "duenos": [{"personaId": 1, "porcentajeTitularidad": 100.0}]},
        "auth": "bearer_ciudadano", "status": 201
    },
    {
        "folder": "03_Organizaciones", "name": "01_Post_Organizacion_Empleado_Success",
        "method": "POST", "path": "/organizaciones",
        "body": {"cuit": "30-22222222-9", "razonSocial": "Empresa Test 2", "nombreFantasia": "Empresa Test 2", "duenos": [{"personaId": 1, "porcentajeTitularidad": 50.0}, {"personaId": 2, "porcentajeTitularidad": 50.0}]},
        "auth": "bearer_empleado", "status": 201
    },
    {
        "folder": "03_Organizaciones", "name": "02_Post_Organizacion_Invalid_400",
        "method": "POST", "path": "/organizaciones",
        "body": {"cuit": "invalid", "razonSocial": "Empresa Test"},
        "auth": "bearer_ciudadano", "status": 400
    },
    {
        "folder": "03_Organizaciones", "name": "03_Get_All_Organizaciones",
        "method": "GET", "path": "/organizaciones", "auth": "bearer_empleado", "status": 200
    },
    {
        "folder": "03_Organizaciones", "name": "04_Get_Organizacion_By_Id_Ciudadano",
        "method": "GET", "path": "/organizaciones/1", "auth": "bearer_ciudadano", "status": 200
    },
    {
        "folder": "03_Organizaciones", "name": "04_Get_Organizacion_By_Id_Empleado",
        "method": "GET", "path": "/organizaciones/1", "auth": "bearer_empleado", "status": 200
    },
    {
        "folder": "03_Organizaciones", "name": "05_Put_Organizacion_Success",
        "method": "PUT", "path": "/organizaciones/1",
        "body": {"razonSocial": "Empresa Actualizada", "nombreFantasia": "Fantasía"},
        "auth": "bearer_ciudadano", "status": 200
    },
    {
        "folder": "03_Organizaciones", "name": "06_Patch_Organizacion_Estado",
        "method": "PATCH", "path": "/organizaciones/1/estado",
        "body": {"estado": "INACTIVO"},
        "auth": "bearer_empleado", "status": 200
    },
    {
        "folder": "03_Organizaciones", "name": "07_Post_Duenos_Success",
        "method": "POST", "path": "/organizaciones/1/duenos",
        "body": {"personaId": 3, "porcentajeTitularidad": 50.0, "ajustes": [{"personaId": 1, "nuevoPorcentaje": 50.0}]},
        "auth": "bearer_ciudadano", "status": 201
    },
    {
        "folder": "03_Organizaciones", "name": "08_Delete_Duenos_Success",
        "method": "DELETE", "path": "/organizaciones/1/duenos/3?beneficiarioId=1", "auth": "bearer_ciudadano", "status": 204
    },

    # ==================== PERSONAS JURIDICAS ====================
    {
        "folder": "03B_PersonasJuridicas", "name": "01_Get_PersonaJuridica",
        "method": "GET", "path": "/personas-juridicas/2", "auth": "bearer_empleado", "status": 200
    },
    {
        "folder": "03B_PersonasJuridicas", "name": "02_Post_Integrante",
        "method": "POST", "path": "/personas-juridicas/2/integrantes",
        "body": {"ciudadanoId": 1},
        "auth": "bearer_empleado", "status": 201
    },
    {
        "folder": "03B_PersonasJuridicas", "name": "03_Delete_Integrante",
        "method": "DELETE", "path": "/personas-juridicas/2/integrantes/1",
        "auth": "bearer_empleado", "status": 204
    },

    # ==================== DOMICILIOS ====================
    {
        "folder": "04_Domicilios", "name": "01_Post_Domicilio_Success",
        "method": "POST", "path": "/personas/1/domicilios",
        "body": {"tipo": "CASA", "calle": "Falsa", "numero": "123", "idBarrio": "123e4567-e89b-12d3-a456-426614174000", "coords": "0,0"},
        "auth": "bearer_ciudadano", "status": 201
    },
    {
        "folder": "04_Domicilios", "name": "02_Post_Domicilio_400",
        "method": "POST", "path": "/personas/1/domicilios",
        "body": {"tipo": "INVALID", "calle": "Falsa"},
        "auth": "bearer_ciudadano", "status": 400
    },
    {
        "folder": "04_Domicilios", "name": "03_Get_Domicilios_Propio",
        "method": "GET", "path": "/personas/1/domicilios", "auth": "bearer_ciudadano", "status": 200
    },
    {
        "folder": "04_Domicilios", "name": "04_Get_Domicilios_Tercero_Empleado",
        "method": "GET", "path": "/personas/1/domicilios", "auth": "bearer_empleado", "status": 200
    },
    {
        "folder": "04_Domicilios", "name": "05_Patch_Domicilio_Principal",
        "method": "PATCH", "path": "/domicilios/1/principal", "auth": "bearer_ciudadano", "status": 200
    },
    {
        "folder": "04_Domicilios", "name": "06_Delete_Domicilio",
        "method": "DELETE", "path": "/domicilios/1", "auth": "bearer_ciudadano", "status": 200
    },

    # ==================== CONTACTOS ====================
    {
        "folder": "05_Contactos", "name": "01_Post_Contacto_Success",
        "method": "POST", "path": "/ciudadanos/1/contactos",
        "body": {"tipo": "EMAIL", "valor": "user@example.com"},
        "auth": "bearer_ciudadano", "status": 201
    },
    {
        "folder": "05_Contactos", "name": "02_Get_Contactos",
        "method": "GET", "path": "/ciudadanos/1/contactos", "auth": "bearer_ciudadano", "status": 200
    },
    {
        "folder": "05_Contactos", "name": "03_Verify_Contacto",
        "method": "PATCH", "path": "/contactos/1/verificar",
        "body": {"codigo": "123456"},
        "auth": "bearer_ciudadano", "status": 200
    },
    {
        "folder": "05_Contactos", "name": "04_Delete_Contacto",
        "method": "DELETE", "path": "/contactos/1", "auth": "bearer_ciudadano", "status": 204
    },

    # ==================== RELACIONES ====================
    {
        "folder": "06_Relaciones", "name": "01_Post_Relacion_Success",
        "method": "POST", "path": "/relaciones",
        "body": {"ciudadanoId1": 1, "ciudadanoId2": 2, "relacionCiudadano1": "PADRE", "relacionCiudadano2": "HIJO", "esResponsable": True},
        "auth": "bearer_empleado", "status": 201
    },
    {
        "folder": "06_Relaciones", "name": "02_Post_Relacion_Invalid_Type_400",
        "method": "POST", "path": "/relaciones",
        "body": {"ciudadanoId1": 1, "ciudadanoId2": 2, "relacionCiudadano1": "AMIGO", "relacionCiudadano2": "AMIGO", "esResponsable": False},
        "auth": "bearer_empleado", "status": 400
    },
    {
        "folder": "06_Relaciones", "name": "03_Get_Relaciones",
        "method": "GET", "path": "/ciudadanos/1/relaciones", "auth": "bearer_ciudadano", "status": 200
    },
    {
        "folder": "06_Relaciones", "name": "04_Patch_Relacion_Responsable",
        "method": "PATCH", "path": "/relaciones/1/responsable",
        "body": {"esResponsable": False},
        "auth": "bearer_empleado", "status": 200
    },
    {
        "folder": "06_Relaciones", "name": "05_Delete_Relacion",
        "method": "DELETE", "path": "/relaciones/1", "auth": "bearer_empleado", "status": 204
    },

    # ==================== REPRESENTACIONES ====================
    {
        "folder": "07_Representaciones", "name": "01_Post_Representacion_Success",
        "method": "POST", "path": "/representaciones",
        "body": {"personaId": 1, "organizacionId": 1, "alcance": "LEGAL", "desde": "2026-01-01", "hasta": "2027-01-01"},
        "auth": "bearer_ciudadano", "status": 201
    },
    {
        "folder": "07_Representaciones", "name": "02_Get_Representaciones_Org",
        "method": "GET", "path": "/organizaciones/1/representaciones", "auth": "bearer_empleado", "status": 200
    },
    {
        "folder": "07_Representaciones", "name": "03_Get_Representaciones_Persona",
        "method": "GET", "path": "/personas/1/representaciones", "auth": "bearer_ciudadano", "status": 200
    },
    {
        "folder": "07_Representaciones", "name": "04_Patch_Representacion_Estado",
        "method": "PATCH", "path": "/representaciones/1/estado",
        "body": {"estado": "REVOCADA"},
        "auth": "bearer_ciudadano", "status": 200
    },
    {
        "folder": "07_Representaciones", "name": "05_Get_Representacion_Vigencia",
        "method": "GET", "path": "/representaciones/vigencia?ciudadanoId=1&organizacionId=1", "auth": "bearer_empleado", "status": 200
    },

    # ==================== DOCUMENTACION ====================
    {
        "folder": "08_Documentacion", "name": "01_Get_Documentos_Persona",
        "method": "GET", "path": "/personas/1/documentos", "auth": "bearer_ciudadano", "status": 200
    },
    {
        "folder": "08_Documentacion", "name": "02_Get_Documento_By_Id",
        "method": "GET", "path": "/documentos/1", "auth": "bearer_empleado", "status": 200
    },
    {
        "folder": "08_Documentacion", "name": "03_Patch_Validar_Documento_Success",
        "method": "PATCH", "path": "/documentos/1/validar",
        "body": {"aprobado": True},
        "auth": "bearer_empleado", "status": 200
    },
    {
        "folder": "08_Documentacion", "name": "04_Patch_Validar_Documento_Ciudadano_403",
        "method": "PATCH", "path": "/documentos/1/validar",
        "body": {"aprobado": True},
        "auth": "bearer_ciudadano", "status": 403
    },
    {
        "folder": "08_Documentacion", "name": "05_Post_Solicitud",
        "method": "POST", "path": "/solicitudes-documentacion",
        "body": {"titularId": 1, "tipoDocumento": "DNI", "plazo": "2027-01-01", "origen": "INTERNO"},
        "auth": "bearer_empleado", "status": 201
    },
    {
        "folder": "08_Documentacion", "name": "06_Get_Solicitudes",
        "method": "GET", "path": "/solicitudes-documentacion", "auth": "bearer_empleado", "status": 200
    },
    {
        "folder": "08_Documentacion", "name": "07_Patch_Solicitud_Estado",
        "method": "PATCH", "path": "/solicitudes-documentacion/1/estado",
        "body": {"estado": "CUMPLIDA"},
        "auth": "bearer_empleado", "status": 200
    },

    # ==================== EXPEDIENTES ====================
    {
        "folder": "09_Expedientes", "name": "01_Post_Expediente",
        "method": "POST", "path": "/expedientes",
        "body": {"personaId": 1, "areaIniciadora": "Mesa de Entradas", "caratula": "Test"},
        "auth": "bearer_empleado", "status": 201
    },
    {
        "folder": "09_Expedientes", "name": "02_Get_Expedientes_Ciudadano",
        "method": "GET", "path": "/expedientes", "auth": "bearer_ciudadano", "status": 200
    },
    {
        "folder": "09_Expedientes", "name": "03_Get_Expediente_ById",
        "method": "GET", "path": "/expedientes/1", "auth": "bearer_ciudadano", "status": 200
    },
    {
        "folder": "09_Expedientes", "name": "04_Get_Actuaciones",
        "method": "GET", "path": "/expedientes/1/actuaciones", "auth": "bearer_empleado", "status": 200
    },
    {
        "folder": "09_Expedientes", "name": "05_Patch_Expediente_Estado",
        "method": "PATCH", "path": "/expedientes/1/estado",
        "body": {"estado": "RESUELTO"},
        "auth": "bearer_empleado", "status": 200
    },
    {
        "folder": "09_Expedientes", "name": "06_Patch_Expediente_Estado_Forbidden_403",
        "method": "PATCH", "path": "/expedientes/1/estado",
        "body": {"estado": "RESUELTO"},
        "auth": "bearer_ciudadano", "status": 403
    },

    # ==================== INTERMODULO ====================
    {
        "folder": "10_Intermodulo", "name": "01_Get_Identidad_Ciudadano",
        "method": "GET", "path": "/ciudadanos/1/identidad", "auth": "bearer_empleado", "status": 200
    },
    {
        "folder": "10_Intermodulo", "name": "02_Get_Identidad_Organizacion",
        "method": "GET", "path": "/organizaciones/1/identidad", "auth": "bearer_empleado", "status": 200
    },
    {
        "folder": "10_Intermodulo", "name": "03_Get_Estado",
        "method": "GET", "path": "/ciudadanos/1/estado", "auth": "bearer_empleado", "status": 200
    },
    {
        "folder": "10_Intermodulo", "name": "04_Get_Domicilio_Principal",
        "method": "GET", "path": "/personas/1/domicilio-principal", "auth": "bearer_empleado", "status": 200
    }
]

for ep in endpoints:
    write_bru_file(
        folder=ep["folder"],
        filename=ep["name"],
        method=ep["method"],
        path=ep["path"],
        body=ep.get("body"),
        auth_type=ep.get("auth", "none"),
        post_script=ep.get("post_script"),
        status_check=ep.get("status", 200)
    )

print("Bruno collection generated successfully with extensive paths and explicit JWT configurations.")
