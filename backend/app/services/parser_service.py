import os
from tree_sitter import Language, Parser

# Import language modules
try:
    import tree_sitter_python
    import tree_sitter_javascript
    import tree_sitter_typescript
    import tree_sitter_go
    import tree_sitter_java
    import tree_sitter_cpp
    import tree_sitter_c
except ImportError as e:
    print(f"Error importing tree-sitter packages: {e}")

class ParserService:
    # Cache initialized languages and parsers
    _parsers = {}
    
    @classmethod
    def _get_parser_for_language(cls, language_name: str):
        """
        Retrieves or initializes a tree-sitter parser for a specific language.
        """
        if language_name in cls._parsers:
            return cls._parsers[language_name]
            
        try:
            if language_name == "Python":
                lang = Language(tree_sitter_python.language())
            elif language_name == "JavaScript":
                lang = Language(tree_sitter_javascript.language())
            elif language_name == "TypeScript":
                lang = Language(tree_sitter_typescript.language_typescript())
            elif language_name == "TSX":  # We treat tsx slightly differently
                lang = Language(tree_sitter_typescript.language_tsx())
            elif language_name == "Go":
                lang = Language(tree_sitter_go.language())
            elif language_name == "Java":
                lang = Language(tree_sitter_java.language())
            elif language_name == "C++":
                lang = Language(tree_sitter_cpp.language())
            elif language_name == "C":
                lang = Language(tree_sitter_c.language())
            else:
                return None
                
            parser = Parser(lang)
            cls._parsers[language_name] = parser
            return parser
        except Exception as e:
            print(f"Error loading parser for {language_name}: {e}")
            return None

    @staticmethod
    def _get_node_name(node, source_bytes: bytes) -> str:
        """
        Extracts the name identifier of a class/function/method definition node.
        """
        # Try finding name by field
        name_node = node.child_by_field_name("name")
        if name_node:
            return source_bytes[name_node.start_byte:name_node.end_byte].decode("utf-8", errors="ignore")
            
        # Fallback: find the first child that is an identifier or type_identifier
        for child in node.children:
            if child.type in ("identifier", "type_identifier", "property_identifier"):
                return source_bytes[child.start_byte:child.end_byte].decode("utf-8", errors="ignore")
                
        return "anonymous"

    @classmethod
    def parse_file(cls, file_full_path: str, rel_path: str, language: str) -> list:
        """
        Parses a file and extracts key logical chunks (functions, classes, methods).
        If the file lacks definition structure, returns the entire file as a module block.
        """
        if not os.path.exists(file_full_path):
            return []
            
        with open(file_full_path, "r", encoding="utf-8", errors="ignore") as f:
            source_code = f.read()
            
        if not source_code.strip():
            return []
            
        source_bytes = source_code.encode("utf-8")
        
        # Detect exact language parser key
        parser_lang = language
        if language == "TypeScript":
            if file_full_path.endswith(".tsx"):
                parser_lang = "TSX"
                
        parser = cls._get_parser_for_language(parser_lang)
        if not parser:
            # Fallback: if no parser available for the language, return the full file as a chunk
            return [{
                "type": "module",
                "name": rel_path,
                "content": source_code,
                "start_line": 1,
                "end_line": len(source_code.splitlines()) or 1
            }]
            
        tree = parser.parse(source_bytes)
        root_node = tree.root_node
        
        chunks = []
        
        # Language-specific definitions we want to extract
        def definition_visitor(node, parent_class=None):
            node_type = node.type
            is_definition = False
            chunk_type = None
            name = None
            
            # Python definitions
            if parser_lang == "Python":
                if node_type == "class_definition":
                    is_definition = True
                    chunk_type = "class"
                elif node_type == "function_definition":
                    is_definition = True
                    chunk_type = "function" if not parent_class else "method"
                    
            # JS / TS / TSX definitions
            elif parser_lang in ("JavaScript", "TypeScript", "TSX"):
                if node_type in ("class_declaration", "class_definition"):
                    is_definition = True
                    chunk_type = "class"
                elif node_type in ("function_declaration", "function_definition"):
                    is_definition = True
                    chunk_type = "function"
                elif node_type == "method_definition":
                    is_definition = True
                    chunk_type = "method"
                    
            # Go definitions
            elif parser_lang == "Go":
                if node_type == "function_declaration":
                    is_definition = True
                    chunk_type = "function"
                elif node_type == "method_declaration":
                    is_definition = True
                    chunk_type = "method"
                elif node_type == "type_declaration":
                    # Check if it defines a struct or interface
                    type_spec = node.child_by_field_name("name") or node
                    is_definition = True
                    chunk_type = "type"
                    
            # Java definitions
            elif parser_lang == "Java":
                if node_type in ("class_declaration", "interface_declaration", "enum_declaration"):
                    is_definition = True
                    chunk_type = "class"
                elif node_type == "method_declaration":
                    is_definition = True
                    chunk_type = "method"

            # C / C++ definitions
            elif parser_lang in ("C", "C++"):
                if node_type in ("class_specifier", "struct_specifier"):
                    is_definition = True
                    chunk_type = "class"
                elif node_type == "function_definition":
                    is_definition = True
                    chunk_type = "function" if not parent_class else "method"
            
            if is_definition:
                name = cls._get_node_name(node, source_bytes)
                start_line = node.start_point[0] + 1
                end_line = node.end_point[0] + 1
                content = source_bytes[node.start_byte:node.end_byte].decode("utf-8", errors="ignore")
                
                # Append to chunks list
                chunks.append({
                    "type": chunk_type,
                    "name": f"{parent_class}.{name}" if (parent_class and chunk_type == "method") else name,
                    "content": content,
                    "start_line": start_line,
                    "end_line": end_line
                })
                
                # If it's a class definition, we walk inside it to extract methods as separate chunks.
                # If it's a function/method, we don't walk inside it (to keep the function intact).
                if chunk_type == "class":
                    for child in node.children:
                        definition_visitor(child, parent_class=name)
                return
                
            # If not a definition node, traverse children
            for child in node.children:
                definition_visitor(child, parent_class=parent_class)
                
        definition_visitor(root_node)
        
        # If no structural chunks were found, fallback to chunking the entire file as a module
        if not chunks:
            chunks.append({
                "type": "module",
                "name": rel_path,
                "content": source_code,
                "start_line": 1,
                "end_line": len(source_code.splitlines()) or 1
            })
            
        return chunks
