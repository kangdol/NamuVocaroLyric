import os
import shutil
import pymupdf

def update_manual():
    pdf_path = "배포 폴더/사용설명서.pdf"
    temp_path = "배포 폴더/temp_manual.pdf"
    
    doc = pymupdf.open(pdf_path)
    page = doc[6]
    
    # 기존 영역 삭제
    rect = pymupdf.Rect(70, 70, 550, 150)
    page.add_redact_annot(rect, fill=(1, 1, 1))
    page.apply_redactions()
    
    # 폰트 등록
    font_name = "gulim"
    page.insert_font(fontname=font_name, fontfile="C:/Windows/Fonts/gulim.ttc")
    
    # 텍스트 삽입 (줄바꿈 처리)
    text = (
        "각종 문의나 버그 리포트는 https://namu.wiki/discuss/사용자:kangdol 이나\n"
        "https://forms.gle/pYZpdNvonuGNDMNt6에 접속하여 작성해 주세요."
    )
    
    textbox_rect = pymupdf.Rect(72, 85, 540, 140)
    page.insert_textbox(textbox_rect, text, fontname=font_name, fontsize=11, color=(0, 0, 0))
    
    # 하이퍼링크 영역 검색 및 링크 삽입
    rects1 = page.search_for("https://namu.wiki/discuss/사용자:kangdol")
    for r in rects1:
        page.insert_link({
            "kind": pymupdf.LINK_URI,
            "from": r,
            "uri": "https://namu.wiki/discuss/사용자:kangdol"
        })
        
    rects2 = page.search_for("https://forms.gle/pYZpdNvonuGNDMNt6")
    for r in rects2:
        page.insert_link({
            "kind": pymupdf.LINK_URI,
            "from": r,
            "uri": "https://forms.gle/pYZpdNvonuGNDMNt6"
        })
    
    doc.save(temp_path, incremental=False, deflate=True)
    doc.close()
    
    shutil.move(temp_path, pdf_path)
    print("PDF 수정 완료")

if __name__ == "__main__":
    update_manual()
